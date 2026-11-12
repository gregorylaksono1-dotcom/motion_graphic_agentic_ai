import type { StoryboardPlan } from '../../types/story.js';
import type { TimedScene, TimedStoryboard } from '../../types/timeline.js';
import type { AssetManifest } from '../../types/asset.js';
import { alignWordsEstimated, formatLandmarkCues } from './audio-aligner.js';
import { computeBeatSlots, beatStats } from './beat-grid.js';

/**
 * Calculates audio duration and frame boundaries for speech text.
 * Average Indonesian/English conversational speech rate is ~2.3 - 2.5 words per second (140 - 150 WPM).
 */
export function calculateSceneTiming(
  spokenText: string,
  voiceSpeed: number = 1.0,
  fps: number = 30
): { durationSeconds: number; durationInFrames: number; wordCount: number } {
  const words = spokenText.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Count punctuation pauses (, . ! ? :)
  const pauses = (spokenText.match(/[,.!?:]/g) || []).length;

  // Base speaking duration: ~2.4 words/second adjusted by voiceSpeed
  const effectiveWordsPerSec = 2.4 * (voiceSpeed || 1.0);
  let durationSeconds = wordCount / effectiveWordsPerSec + pauses * 0.3;

  // Minimum duration: at least 2.5 seconds per scene for visual clarity
  if (durationSeconds < 2.5) {
    durationSeconds = 2.5;
  }

  const durationInFrames = Math.ceil(durationSeconds * fps);

  return {
    durationSeconds: Number(durationSeconds.toFixed(2)),
    durationInFrames,
    wordCount,
  };
}

/**
 * Bridges LLM 1 to LLM 2 by calculating exact timestamps and frame boundaries.
 * Prefers real audio durations from Stage 1b AssetManifest (Gemini TTS) when available.
 */
export function bridgeStoryboardTiming(
  plan: StoryboardPlan,
  fps: number = 30,
  assetManifest?: AssetManifest,
  beatIntervalSec: number = 2.0
): TimedStoryboard {
  console.log(`\n⏱️ [Bridge: Audio Timing Engine] Calculating TTS duration sync & timeline frames...`);

  let currentStartFrame = 0;
  const timedScenes: TimedScene[] = [];

  for (const scene of plan.scenes) {
    const audioAsset = assetManifest?.audioTracks.find((a) => a.sceneNumber === scene.sceneNumber);
    const estimated = calculateSceneTiming(
      scene.ttsVoiceover.spokenText,
      scene.ttsVoiceover.voiceSpeed,
      fps
    );

    const durationSeconds = audioAsset?.durationSeconds ?? estimated.durationSeconds;
    const durationInFrames = audioAsset?.durationInFrames ?? estimated.durationInFrames;
    const endFrame = currentStartFrame + durationInFrames;

    const wordTimings =
      audioAsset?.wordTimings && audioAsset.wordTimings.length > 0
        ? audioAsset.wordTimings
        : alignWordsEstimated(scene.ttsVoiceover.spokenText, durationSeconds, fps);
    const landmarkCues = formatLandmarkCues(wordTimings);
    const beatSlots = computeBeatSlots({
      durationInFrames,
      fps,
      wordTimings,
      beatIntervalSec,
      isHook: timedScenes.length === 0,
      visualBeats: scene.visualBeats,
    });

    timedScenes.push({
      ...scene,
      startFrame: currentStartFrame,
      endFrame,
      durationInFrames,
      durationSeconds,
      wordCount: estimated.wordCount,
      wordTimings,
      landmarkCues,
      beatSlots,
    });

    const stats = beatStats(beatSlots.map((b) => b.localFrame), durationInFrames, fps);
    console.log(
      `  - Scene ${scene.sceneNumber} (${scene.sceneTitle}): ${durationSeconds}s (${durationInFrames}f) | ${beatSlots.length} beats (avg ${stats.avgGapSec}s, max gap ${stats.maxGapSec}s) | Voice: ${scene.ttsVoiceover.geminiVoiceName}`
    );

    currentStartFrame = endFrame;
  }

  const totalDurationInFrames = currentStartFrame;
  const totalDurationSeconds = Number((totalDurationInFrames / fps).toFixed(2));

  console.log(
    `\n📊 Total Video Duration: ${totalDurationSeconds}s (${totalDurationInFrames} frames @ ${fps}fps)`
  );

  return {
    title: plan.title,
    synopsis: plan.synopsis,
    visualStyle: plan.visualStyle,
    targetAudience: plan.targetAudience,
    fps,
    totalDurationInFrames,
    totalDurationSeconds,
    timedScenes,
  };
}
