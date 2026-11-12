import 'dotenv/config';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { RemotionProjectWriter } from './generator/writer.js';
import { computeBeatSlots } from './stages/bridge/beat-grid.js';
import { enforceBlueprint } from './stages/stage2-director/beat-enforcer.js';
import { buildMainComposition } from './stages/stage3-coder/agent.js';
import { StyleAnalystAgent } from './stages/stage0-style/agent.js';
import { buildStyleProfile, matchPresetExact, pickPresetHeuristically, type StyleProfile } from './styles/presets.js';
import type { DirectorBlueprint } from './types/director.js';
import type { TimedScene, TimedStoryboard } from './types/timeline.js';
import type { WordTiming, AssetManifest } from './types/asset.js';
import { loadAvatarPack } from './avatar/avatar-pack.js';

/**
 * Remix: re-applies the Style + Beat Engine to an EXISTING output/ project without re-running
 * the Scriptwriter / Director / Coder LLMs. Keeps your scene components and voiceover, and regenerates:
 * constants/beats.ts, BeatFX.tsx (+SFX/music), SceneCraft.tsx, KineticCaptions.tsx, MainComposition.tsx, Root.tsx.
 *
 * Usage:
 *   npm run remix                       -> heuristic style from the project synopsis (no LLM)
 *   npm run remix -- --style=neon-tech  -> force a preset
 *   npm run remix -- --style=auto       -> LLM style analyst (1 cheap call)
 */
async function main() {
  const args = process.argv.slice(2);
  const styleArg = args.find((a) => a.startsWith('--style='))?.slice('--style='.length);
  const outputDir = path.resolve(process.cwd(), args.find((a) => a.startsWith('--out='))?.slice(6) || 'output');
  const avatarId = args.find((a) => a.startsWith('--avatar='))?.slice('--avatar='.length) || process.env.AVATAR_ID;
  const handle = args.find((a) => a.startsWith('--handle='))?.slice('--handle='.length) || process.env.BRAND_HANDLE || '';
  const avatar = avatarId ? loadAvatarPack(avatarId) : null;

  const meta = JSON.parse(await fs.readFile(path.join(outputDir, 'metadata.json'), 'utf-8'));
  const timingsSrc = await fs.readFile(path.join(outputDir, 'constants/wordTimings.ts'), 'utf-8');
  const jsonStart = timingsSrc.indexOf('= {') + 2;
  const jsonEnd = timingsSrc.lastIndexOf('};') + 1;
  const wordTimings = JSON.parse(timingsSrc.slice(jsonStart, jsonEnd)) as Record<string, WordTiming[]>;
  const fps: number = meta.fps || 30;

  let style: StyleProfile;
  const exact = styleArg ? matchPresetExact(styleArg) : null;
  if (exact) {
    style = buildStyleProfile(exact, { source: 'user', reasoning: 'Remix --style' });
  } else if (styleArg) {
    const synopsis = `${meta.projectName} ${meta.synopsis}`;
    style = await new StyleAnalystAgent().resolveStyle(synopsis, styleArg === 'auto' ? undefined : styleArg);
  } else {
    const h = pickPresetHeuristically(`${meta.projectName} ${meta.synopsis} ${meta.scenes.map((s: any) => s.captionText).join(' ')}`);
    style = buildStyleProfile(h.id, { source: 'heuristic', reasoning: `Remix heuristic (score ${h.score})` });
  }
  console.log(`🎨 Remix style: ${style.id} (${style.source}) | beat ${style.pacing.beatIntervalSec}s | camera ${style.pacing.cameraIntensity}`);

  const timedScenes: TimedScene[] = meta.scenes.map((s: any, idx: number) => {
    const wt = wordTimings[String(s.sceneNumber)] || [];
    return {
      sceneNumber: s.sceneNumber,
      sceneTitle: s.componentName,
      visualStyleTag: s.visualStyleTag,
      ttsVoiceover: {
        spokenText: s.captionText,
        voiceGender: 'male',
        voiceTone: style.voice.voiceTone,
        voiceSpeed: style.voice.voiceSpeed,
        emotion: '',
        geminiVoiceName: style.voice.geminiVoiceName,
        soundEffectsCue: [],
      },
      visualConcept: (s.visualElements || []).join(', '),
      keyVisualAction: (s.keyframeEvents || []).join(' | '),
      visualBeats: [],
      characters: [],
      requiredMcpTools: [],
      mood: 'energetic',
      startFrame: s.startFrame,
      endFrame: s.startFrame + s.durationInFrames,
      durationInFrames: s.durationInFrames,
      durationSeconds: s.durationInFrames / fps,
      wordCount: wt.length,
      wordTimings: wt,
      beatSlots: computeBeatSlots({
        durationInFrames: s.durationInFrames,
        fps,
        wordTimings: wt,
        beatIntervalSec: style.pacing.beatIntervalSec,
        isHook: idx === 0,
      }),
    } as TimedScene;
  });

  const timed: TimedStoryboard = {
    title: meta.projectName,
    synopsis: meta.synopsis,
    visualStyle: style.label,
    targetAudience: '',
    fps,
    totalDurationInFrames: meta.totalDurationInFrames,
    totalDurationSeconds: meta.totalDurationInFrames / fps,
    timedScenes,
  };

  // Keep existing scene component names/paths: they already exist on disk
  const original: DirectorBlueprint = {
    projectName: meta.projectName,
    mainCompositionName: meta.mainCompositionName,
    mainFilePath: meta.mainFilePath,
    width: meta.width,
    height: meta.height,
    fps,
    totalDurationInFrames: meta.totalDurationInFrames,
    sharedTypesCode: '',
    sharedThemeCode: '',
    backgroundComponent: { componentName: 'BackgroundLayer', filePath: 'components/common/BackgroundLayer.tsx', description: '' },
    scenes: meta.scenes.map((s: any) => ({ ...s, beats: s.beats || [], highlightWords: s.highlightWords || [] })),
    directorNotes: '',
  };
  const enforced = enforceBlueprint(original, timed, style, {
    avatarPoses: avatar ? avatar.poses.map((p) => ({ id: p.id, hint: p.hint })) : undefined,
  });
  enforced.scenes = enforced.scenes.map((s, i) => ({
    ...s,
    componentName: original.scenes[i].componentName,
    filePath: original.scenes[i].filePath,
    // Remix must not change worlds/transitions of already-coded scenes
    visualStyleTag: original.scenes[i].visualStyleTag,
    transitionIn: original.scenes[i].transitionIn,
    captionTheme: original.scenes[i].captionTheme,
  }));

  const writer = new RemotionProjectWriter(path.relative(process.cwd(), outputDir));
  await writer.writeBeatsFile(enforced, style);
  await writer.writeBeatFxLayer(style);
  await writer.writeSceneCraftComponent();
  await writer.writeKineticCaptionsComponent();
  await writer.writeHeadlineCaptionsComponent();
  await writer.writeUserAssetsFile();

  const audioTracks = enforced.scenes
    .filter((s) => fsSync.existsSync(path.join(outputDir, `assets/audio/scene_${s.sceneNumber}.wav`)))
    .map((s) => ({
      sceneNumber: s.sceneNumber,
      filePath: `assets/audio/scene_${s.sceneNumber}.wav`,
      absolutePath: path.join(outputDir, `assets/audio/scene_${s.sceneNumber}.wav`),
      durationSeconds: s.durationInFrames / fps,
      durationInFrames: s.durationInFrames,
      voiceUsed: style.voice.geminiVoiceName,
      fileSize: 0,
    }));
  const manifest: AssetManifest = { audioTracks, dataAssets: [], visualAssets: [], totalAudioDurationFrames: enforced.totalDurationInFrames };
  await writer.writePresenterLayer(
    enforced,
    { chapterLabel: meta.chapterLabel || String(meta.projectName).toUpperCase(), cornerLabel: meta.cornerLabel || 'LIVE', handle, enabled: style.layoutMode === 'evidence' },
    avatar,
    manifest
  );
  await writer.writeComponentFile(
    buildMainComposition(enforced, manifest, {
      captionMode: style.captionMode,
      avatar: !!avatar,
      brandFrame: style.layoutMode === 'evidence' || !!handle,
      genome: style.genome,
    })
  );
  await writer.finalizeProject(enforced, meta.synopsis, style);

  console.log(`\n✅ Remix complete. Run 'npm run preview' or 'npm run render'.`);
}

main().catch((err) => {
  console.error('❌ Remix failed:', err.message || err);
  process.exit(1);
});
