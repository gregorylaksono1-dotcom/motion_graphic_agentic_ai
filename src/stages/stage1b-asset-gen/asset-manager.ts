import fs from 'node:fs/promises';
import path from 'node:path';
import type { StoryboardPlan } from '../../types/story.js';
import type { AssetManifest, GeneratedAudioAsset, GeneratedDataAsset, GeneratedVisualAsset } from '../../types/asset.js';
import type { StructuredTool } from '@langchain/core/tools';
import { costTracker } from '../../core/cost-tracker.js';
import { alignWordsToWav, alignWordsEstimated } from '../bridge/audio-aligner.js';
import { calculateSceneTiming } from '../bridge/timing.js';
import { writeSilentWav } from '../../generator/audio-fx.js';

/**
 * real  = call Gemini TTS via MCP (costs money)
 * dummy = write a SILENT wav with estimated duration + estimated word timings (free; exercises the full audio wiring)
 * skip  = no audio files at all; timings estimated from word count (free)
 */
export type TtsMode = 'real' | 'dummy' | 'skip';

export function parseTtsMode(value?: string): TtsMode {
  const v = (value || '').trim().toLowerCase();
  if (v === 'dummy' || v === 'mock' || v === 'fake') return 'dummy';
  if (v === 'skip' || v === 'off' || v === 'none') return 'skip';
  return 'real';
}

export class AssetGenerationManager {
  private baseOutputDir: string;
  private ttsMode: TtsMode;

  constructor(outputDir: string = './output', options?: { ttsMode?: TtsMode }) {
    this.baseOutputDir = path.resolve(process.cwd(), outputDir);
    this.ttsMode = options?.ttsMode || 'real';
  }

  /**
   * Stage 1b: Executes asset generation via MCP Tools (TTS audio, polygons, icons, images)
   */
  async generateAssets(
    storyboard: StoryboardPlan,
    mcpTools: StructuredTool[] = [],
    fps: number = 30
  ): Promise<AssetManifest> {
    console.log(`\n🎨 [Stage 1b: Asset & Resource Generation] Starting physical asset generation... (TTS mode: ${this.ttsMode})`);

    const audioTracks: GeneratedAudioAsset[] = [];
    const dataAssets: GeneratedDataAsset[] = [];
    const visualAssets: GeneratedVisualAsset[] = [];

    // Find Gemini TTS tool if available in loaded MCP tools
    const ttsTool = mcpTools.find(
      (t) => t.name.includes('generate_gemini_tts') || t.name === 'generate_gemini_tts'
    );

    let totalAudioDurationFrames = 0;

    for (const scene of storyboard.scenes) {
      console.log(`\n  ▶️ [Scene ${scene.sceneNumber}] Preparing assets for "${scene.sceneTitle}"...`);

      // 1. GENERATE AUDIO TTS VIA GEMINI MCP
      const audioRelativePath = `assets/audio/scene_${scene.sceneNumber}.wav`;
      const audioFullPath = path.join(this.baseOutputDir, audioRelativePath);
      await fs.mkdir(path.dirname(audioFullPath), { recursive: true });

      let durationSec = Math.max(2.5, scene.ttsVoiceover.spokenText.split(/\s+/).length / 2.3);
      let voiceUsed = scene.ttsVoiceover.geminiVoiceName || 'Puck';
      let audioGenerated = false;
      let fileSize = 0;

      if (this.ttsMode === 'dummy') {
        // FREE: silent wav with estimated duration so captions, beats, SFX & audio wiring are all exercised
        const est = calculateSceneTiming(scene.ttsVoiceover.spokenText, scene.ttsVoiceover.voiceSpeed, fps);
        const dummyDuration = Number((est.durationSeconds + 0.35).toFixed(2));
        fileSize = await writeSilentWav(audioFullPath, dummyDuration);
        const durationInFrames = Math.ceil(dummyDuration * fps);
        totalAudioDurationFrames += durationInFrames;
        audioTracks.push({
          sceneNumber: scene.sceneNumber,
          filePath: audioRelativePath,
          absolutePath: audioFullPath,
          durationSeconds: dummyDuration,
          durationInFrames,
          voiceUsed: `dummy(${voiceUsed})`,
          fileSize,
          speechStartSec: 0.1,
          speechEndSec: est.durationSeconds,
          wordTimings: alignWordsEstimated(scene.ttsVoiceover.spokenText, dummyDuration, fps),
        });
        console.log(`    🧪 Dummy TTS (silent, ${dummyDuration}s): ${audioRelativePath} — no cost`);
      } else if (this.ttsMode === 'skip') {
        console.log(`    ⏭️ TTS skipped (--tts=skip): duration estimated from word count.`);
      } else if (ttsTool) {
        try {
          console.log(`    🎙️ Calling Gemini TTS Tool for scene ${scene.sceneNumber}...`);
          const toolResultStr = await ttsTool.invoke({
            text: scene.ttsVoiceover.spokenText,
            outputPath: path.relative(process.cwd(), audioFullPath),
            voiceName: voiceUsed,
            language: 'id-ID',
          });

          const parsed = typeof toolResultStr === 'string' ? JSON.parse(toolResultStr) : toolResultStr;
          if (parsed.durationSeconds) {
            durationSec = parsed.durationSeconds;
          }
          if (parsed.fileSize) {
            fileSize = parsed.fileSize;
          }
          if (parsed.mode === 'gemini_api' && parsed.usage) {
            costTracker.recordCall({
              stage: 'stage1b-gemini-tts',
              provider: 'google',
              model: parsed.modelUsed || 'gemini-3.1-flash-tts-preview',
              inputTokens: parsed.usage.inputTokens ?? 0,
              cachedInputTokens: 0,
              outputTokens: parsed.usage.outputTokens ?? 0,
              totalTokens: parsed.usage.totalTokens ?? 0,
              durationMs: parsed.durationMs ?? 0,
            });
          }
          audioGenerated = true;
          console.log(`    ✅ TTS Audio generated: ${audioRelativePath} (${durationSec}s)`);
        } catch (err: any) {
          console.warn(`    ⚠️ MCP TTS call error: ${err.message}. Skipping audio track for this scene.`);
        }
      } else {
        console.log(`    ℹ️ Gemini TTS tool not connected, continuing without audio file for scene ${scene.sceneNumber}.`);
      }

      const fallbackDurationInFrames = Math.ceil(durationSec * fps);

      if (this.ttsMode === 'dummy') {
        // already handled above
      } else if (audioGenerated) {
        let wordTimings;
        let speechStartSec;
        let speechEndSec;
        try {
          const aligned = await alignWordsToWav(audioFullPath, scene.ttsVoiceover.spokenText, fps);
          wordTimings = aligned.wordTimings;
          speechStartSec = aligned.speechStartSec;
          speechEndSec = aligned.speechEndSec;
          if (aligned.durationSeconds > 0) {
            durationSec = aligned.durationSeconds;
          }
          console.log(
            `    ⏱️ Aligned ${wordTimings.length} words to WAV speech (${speechStartSec}s -> ${speechEndSec}s)`
          );
        } catch (alignErr: any) {
          console.warn(`    ⚠️ Audio alignment warning: ${alignErr.message}`);
        }

        const alignedDurationFrames = Math.ceil(durationSec * fps);
        totalAudioDurationFrames += alignedDurationFrames;

        audioTracks.push({
          sceneNumber: scene.sceneNumber,
          filePath: audioRelativePath,
          absolutePath: audioFullPath,
          durationSeconds: durationSec,
          durationInFrames: alignedDurationFrames,
          voiceUsed,
          fileSize,
          speechStartSec,
          speechEndSec,
          wordTimings,
        });
      } else {
        totalAudioDurationFrames += fallbackDurationInFrames;
      }

      // 2. CHECK & GENERATE POLYGON / DATA ASSETS
      const needsPolygon = scene.requiredMcpTools.some((t) => t.toLowerCase().includes('polygon') || t.toLowerCase().includes('map'));
      if (needsPolygon) {
        const polygonRelativePath = `data/polygon_scene_${scene.sceneNumber}.json`;
        const polygonFullPath = path.join(this.baseOutputDir, polygonRelativePath);
        await fs.mkdir(path.dirname(polygonFullPath), { recursive: true });

        const samplePolygonData = {
          areaName: 'Metropolitan Tech Hub',
          pointsString: '540,180 820,320 780,740 420,860 210,540',
          coordinates: [
            { x: 540, y: 180 },
            { x: 820, y: 320 },
            { x: 780, y: 740 },
            { x: 420, y: 860 },
            { x: 210, y: 540 },
          ],
          center: { lat: -6.2088, lng: 106.8456 },
        };

        await fs.writeFile(polygonFullPath, JSON.stringify(samplePolygonData, null, 2), 'utf-8');
        console.log(`    🗺️ Generated polygon coordinates: ${polygonRelativePath}`);

        dataAssets.push({
          id: `polygon_scene_${scene.sceneNumber}`,
          filePath: polygonRelativePath,
          type: 'polygon',
          data: samplePolygonData,
        });
      }

      // 3. CHECK & GENERATE ICON ASSETS
      const needsIcons = scene.requiredMcpTools.some((t) => t.toLowerCase().includes('icon'));
      if (needsIcons) {
        const iconRelativePath = `assets/icons/scene_${scene.sceneNumber}_symbol.svg`;
        const iconFullPath = path.join(this.baseOutputDir, iconRelativePath);
        await fs.mkdir(path.dirname(iconFullPath), { recursive: true });

        const sampleSvgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#00ffcc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
</svg>`;

        await fs.writeFile(iconFullPath, sampleSvgIcon, 'utf-8');
        console.log(`    ⚡ Generated SVG icon: ${iconRelativePath}`);

        visualAssets.push({
          id: `icon_scene_${scene.sceneNumber}`,
          filePath: iconRelativePath,
          type: 'icon',
          hasTransparency: true,
        });
      }
    }

    console.log(`\n✅ [Stage 1b Complete] Total ${audioTracks.length} audio voiceover(s), ${dataAssets.length} data file(s), ${visualAssets.length} visual asset(s) ready to use.\n`);

    return {
      audioTracks,
      dataAssets,
      visualAssets,
      totalAudioDurationFrames,
    };
  }
}

