import 'dotenv/config';
import path from 'node:path';
import { profileFromGenome, presetToGenome, STYLE_PRESETS } from './styles/presets.js';
import { sanitizeGenome, mutateGenome, type StyleGenome } from './styles/genome.js';
import { AssetGenerationManager } from './stages/stage1b-asset-gen/asset-manager.js';
import { bridgeStoryboardTiming } from './stages/bridge/timing.js';
import { enforceBlueprint } from './stages/stage2-director/beat-enforcer.js';
import { buildMainComposition } from './stages/stage3-coder/agent.js';
import { RemotionProjectWriter } from './generator/writer.js';
import type { StoryboardPlan } from './types/story.js';
import type { DirectorBlueprint } from './types/director.js';

/**
 * Offline proof of the Style Genome: renders the SAME two scenes with different genomes.
 *   npm run demo:genome -- --genome=kopi      (kopi | cyber | snack | stoic | mutated)
 *   npx remotion preview output-genome-kopi/index.ts
 * The example genomes mimic what Stage 0 designs for 4 different topics (no LLM call here).
 */
const base: Pick<StyleGenome, 'illustrationWorlds' | 'beatIntervalSec' | 'sfxPack' | 'voice' | 'layoutMode'> = {
  illustrationWorlds: [],
  beatIntervalSec: 1.8,
  sfxPack: 'pop',
  voice: { geminiVoiceName: 'Puck', voiceTone: 'enthusiastic', voiceSpeed: 1.05 },
  layoutMode: 'standard',
};

export const EXAMPLE_GENOMES: Record<string, StyleGenome> = {
  kopi: {
    ...base,
    name: 'Crema Ledger',
    moodWords: ['hangat', 'artisan', 'tenang'],
    palette: { bg: '#3B2418', bgAlt: '#F3E7D3', surface: '#FFF8EC', primary: '#D98E4A', secondary: '#7A9E7E', accent: '#F2C14E', danger: '#C2410C' },
    fonts: { display: 'fraunces', body: 'dm-sans', mono: 'ibm-plex-mono' },
    displayCase: 'none',
    backdrop: { gradient: 'radial', gradientAngle: 160, pattern: 'noise', patternScale: 24, patternOpacity: 0.08, texture: 'paper', vignette: 0.55, decor: 'brush', motion: 'drift' },
    shape: { radius: 22, stroke: 0, shadow: 'soft', cardStyle: 'paper' },
    motion: { energy: 'calm', cameraMode: 'drift', cameraIntensity: 'subtle' },
    caption: { mode: 'pill', treatment: 'plain', highlight: 'color' },
    sticker: 'tape',
    musicMood: 'chill',
    sfxPack: 'soft',
    rationale: 'Coffee business tips: roasted browns and crema paper with a warm serif feel artisan and trustworthy.',
  },
  cyber: {
    ...base,
    name: 'Red Team Dossier',
    moodWords: ['tegang', 'forensik', 'tajam'],
    palette: { bg: '#0E1A14', bgAlt: '#E8F0E4', surface: '#13261D', primary: '#3DFF8B', secondary: '#7C5CFF', accent: '#FF3D6E', danger: '#FF3D6E' },
    fonts: { display: 'space-grotesk', body: 'inter', mono: 'jetbrains-mono' },
    displayCase: 'upper',
    backdrop: { gradient: 'linear', gradientAngle: 200, pattern: 'grid', patternScale: 46, patternOpacity: 0.09, texture: 'scanlines', vignette: 0.6, decor: 'frame', motion: 'drift' },
    shape: { radius: 4, stroke: 2, shadow: 'glow', cardStyle: 'outline' },
    motion: { energy: 'snappy', cameraMode: 'punch', cameraIntensity: 'medium' },
    caption: { mode: 'headline', treatment: 'plain', highlight: 'box' },
    sticker: 'stamp',
    musicMood: 'tech',
    sfxPack: 'tech',
    rationale: 'Security incident: terminal green on forest black, scanlines and framed grid read like a forensic dossier.',
  },
  snack: {
    ...base,
    name: 'Sambal Pop',
    moodWords: ['ceria', 'manis', 'meledak'],
    palette: { bg: '#FFE3EE', bgAlt: '#2D1B69', surface: '#FFFFFF', primary: '#FF4F9A', secondary: '#21C7A8', accent: '#FFD23F', danger: '#FF3B30' },
    fonts: { display: 'unbounded', body: 'outfit', mono: 'space-mono' },
    displayCase: 'none',
    backdrop: { gradient: 'mesh', gradientAngle: 120, pattern: 'dots', patternScale: 30, patternOpacity: 0.1, texture: 'none', vignette: 0.1, decor: 'confetti', motion: 'pulse' },
    shape: { radius: 34, stroke: 4, shadow: 'hard', cardStyle: 'solid' },
    motion: { energy: 'bouncy', cameraMode: 'punch', cameraIntensity: 'punchy' },
    caption: { mode: 'pill', treatment: 'box', highlight: 'marker' },
    sticker: 'pill',
    musicMood: 'playful',
    beatIntervalSec: 1.5,
    rationale: 'Kids snack promo: candy pastel with hot pink and confetti, chunky rounded type, bouncy hard-shadow stickers.',
  },
  stoic: {
    ...base,
    name: 'Marble Silence',
    moodWords: ['hening', 'agung', 'fokus'],
    palette: { bg: '#F2EEE6', bgAlt: '#121212', surface: '#FFFFFF', primary: '#1C1C1C', secondary: '#8A7F6B', accent: '#B08D57', danger: '#8C2F2F' },
    fonts: { display: 'playfair-display', body: 'manrope', mono: 'ibm-plex-mono' },
    displayCase: 'upper',
    backdrop: { gradient: 'flat', gradientAngle: 0, pattern: 'lines', patternScale: 64, patternOpacity: 0.05, texture: 'grain', vignette: 0.3, decor: 'orbits', motion: 'still' },
    shape: { radius: 0, stroke: 1, shadow: 'none', cardStyle: 'outline' },
    motion: { energy: 'calm', cameraMode: 'drift', cameraIntensity: 'subtle' },
    caption: { mode: 'pill', treatment: 'underline', highlight: 'color' },
    sticker: 'outline',
    musicMood: 'emotional',
    sfxPack: 'cinematic',
    beatIntervalSec: 2.2,
    rationale: 'Stoic mindset: bone white and ink black, classical serif capitals, orbits and stillness.',
  },
};

async function main() {
  const args = process.argv.slice(2);
  const key = args.find((a) => a.startsWith('--genome='))?.slice(9) || 'kopi';
  const genome =
    key === 'mutated'
      ? sanitizeGenome(mutateGenome(presetToGenome(STYLE_PRESETS['viral-explainer']), 4242))
      : sanitizeGenome(EXAMPLE_GENOMES[key] as StyleGenome);
  if (!genome) throw new Error(`Unknown genome "${key}"`);
  const style = profileFromGenome(genome, { source: 'auto' });
  const outRel = `output-genome-${key}`;

  const voice = (t: string) => ({ spokenText: t, voiceGender: 'male' as const, voiceTone: style.voice.voiceTone, voiceSpeed: 1.05, emotion: '', geminiVoiceName: style.voice.geminiVoiceName, soundEffectsCue: [] });
  const storyboard: StoryboardPlan = {
    title: 'Genome Demo', synopsis: 'Same scenes, different genome', visualStyle: genome.name, targetAudience: 'umkm',
    chapterLabel: genome.name.toUpperCase(), cornerLabel: 'DEMO',
    scenes: [
      { sceneNumber: 1, sceneTitle: 'Hook', visualStyleTag: 'genome-base', ttsVoiceover: voice('87 persen bisnis kecil tutup di tahun pertama. Penyebab utamanya bukan modal.'), visualConcept: '', keyVisualAction: '', visualBeats: [], characters: [], requiredMcpTools: [], mood: 'energetic' },
      { sceneNumber: 2, sceneTitle: 'List', visualStyleTag: 'genome-alt', ttsVoiceover: voice('Tiga hal yang bikin bertahan: konsisten, kenal pelanggan, dan catat setiap angka.'), visualConcept: '', keyVisualAction: '', visualBeats: [], characters: [], requiredMcpTools: [], mood: 'energetic' },
    ],
  };
  const manifest = await new AssetGenerationManager(outRel, { ttsMode: 'dummy' }).generateAssets(storyboard, [], 30);
  const timed = bridgeStoryboardTiming(storyboard, 30, manifest, style.pacing.beatIntervalSec);
  const b = (anchorWord: string, extra: Record<string, unknown> = {}) => ({ localFrame: 0, anchorWord, action: 'element-enter', visual: '', onScreenText: '', emphasis: 'medium', sfx: 'none', avatarPose: '', ...extra });
  const draft = {
    projectName: 'GenomeDemo', mainCompositionName: 'MainComposition', mainFilePath: 'components/MainComposition.tsx', width: 1080, height: 1920, fps: 30,
    totalDurationInFrames: timed.totalDurationInFrames, sharedTypesCode: 'export {};\n', sharedThemeCode: 'export {};\n',
    backgroundComponent: { componentName: 'BackgroundLayer', filePath: 'components/common/BackgroundLayer.tsx', description: '' }, directorNotes: '',
    scenes: [
      { sceneNumber: 1, componentName: 'Scene1Hook', filePath: '', visualStyleTag: 'genome-base', transitionIn: style.transitions[0], captionTheme: 'light-pill', startFrame: 0, durationInFrames: 0, captionText: '', expectedPropsInterface: 'none', keyframeEvents: [], visualElements: [], highlightWords: ['87', 'modal'],
        beats: [b('87', { action: 'counter', emphasis: 'high', onScreenText: '87%' }), b('tutup'), b('Penyebab', { action: 'reveal' }), b('modal', { action: 'highlight', onScreenText: 'BUKAN MODAL' })] },
      { sceneNumber: 2, componentName: 'Scene2List', filePath: '', visualStyleTag: 'genome-alt', transitionIn: style.transitions[1] || style.transitions[0], captionTheme: 'light-pill', startFrame: 0, durationInFrames: 0, captionText: '', expectedPropsInterface: 'none', keyframeEvents: [], visualElements: [], highlightWords: ['konsisten', 'angka'],
        beats: [b('Tiga'), b('konsisten'), b('pelanggan'), b('angka', { emphasis: 'high' })] },
    ],
  } as unknown as DirectorBlueprint;
  const blueprint = enforceBlueprint(draft, timed, style);
  blueprint.scenes = blueprint.scenes.map((s, i) => ({ ...s, componentName: draft.scenes[i].componentName, filePath: `components/scenes/${draft.scenes[i].componentName}.tsx` }));

  const w = new RemotionProjectWriter(outRel);
  await w.cleanComponentsDir();
  await w.writeContractFiles(blueprint);
  await w.writeWordTimingsFile(blueprint, manifest);
  await w.writeKineticCaptionsComponent();
  await w.writeSceneCraftComponent();
  await w.writeBeatsFile(blueprint, style);
  await w.writeBeatFxLayer(style);
  await w.writeHeadlineCaptionsComponent();
  await w.writeUserAssetsFile();
  await w.writePresenterLayer(blueprint, { chapterLabel: storyboard.chapterLabel, cornerLabel: storyboard.cornerLabel, handle: '', enabled: style.layoutMode === 'evidence' || style.captionMode === 'headline' }, null, manifest);
  await w.writeComponentFile({ filePath: 'components/common/BackgroundLayer.tsx', exportedSymbols: [], notes: '', code: `import React from 'react';\nimport { AbsoluteFill } from 'remotion';\nimport { TOKENS } from '../../constants/genome';\n\nexport const BackgroundLayer: React.FC = () => <AbsoluteFill style={{ backgroundColor: TOKENS.palette.bg }} />;\n` });
  const headline = style.captionMode === 'headline';
  const pad = headline ? "'480px 56px 600px 56px'" : "'86px 56px 330px 56px'";
  await w.writeComponentFile({
    filePath: 'components/scenes/Scene1Hook.tsx', exportedSymbols: [], notes: '',
    code: `import React from 'react';
import { AbsoluteFill } from 'remotion';
import { SceneBackdrop, SceneTransitionWipe, ChapterBadge, SceneHeadline, StatCounter, IconPop, KineticWords } from '../common/SceneCraft';
import { anchorFrame } from '../../constants/beats';
import { TOKENS } from '../../constants/genome';

export const Scene1Hook: React.FC<{ durationInFrames?: number }> = ({ durationInFrames = ${blueprint.scenes[0].durationInFrames} }) => {
  const at = (w: string, fb = 0) => anchorFrame(1, w, fb);
  return (
    <SceneTransitionWipe transition="${blueprint.scenes[0].transitionIn}" durationInFrames={durationInFrames}>
      <SceneBackdrop variant="genome-base" />
      <AbsoluteFill style={{ padding: ${pad}, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        ${headline ? '' : `<ChapterBadge sceneNumber={1} totalScenes={2} label="Fakta UMKM" variant="genome-base" />
        <SceneHeadline title="Kenapa bisnis kecil tutup?" variant="genome-base" />`}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 46 }}>
          <StatCounter to={87} suffix="%" startFrame={at('87')} durationFrames={20} color={TOKENS.palette.accent} label="tutup di tahun pertama" variant="genome-base" fontSize={200} />
          <div style={{ display: 'flex', gap: 40 }}>
            <IconPop name="Store" startFrame={at('tutup')} label="Toko" variant="genome-base" />
            <IconPop name="Wallet" startFrame={at('modal')} bgColor={TOKENS.palette.danger} color={TOKENS.palette.onDanger} label="Bukan modal" variant="genome-base" />
          </div>
          <KineticWords text="Lalu apa penyebabnya?" startFrame={at('Penyebab')} fontSize={64} highlight={['penyebabnya']} accentColor={TOKENS.palette.accent} variant="genome-base" />
        </div>
      </AbsoluteFill>
    </SceneTransitionWipe>
  );
};
`,
  });
  await w.writeComponentFile({
    filePath: 'components/scenes/Scene2List.tsx', exportedSymbols: [], notes: '',
    code: `import React from 'react';
import { AbsoluteFill } from 'remotion';
import { SceneBackdrop, SceneTransitionWipe, ChapterBadge, SceneHeadline, RevealList } from '../common/SceneCraft';
import { anchorFrame } from '../../constants/beats';

export const Scene2List: React.FC<{ durationInFrames?: number }> = ({ durationInFrames = ${blueprint.scenes[1].durationInFrames} }) => {
  const at = (w: string, fb = 0) => anchorFrame(2, w, fb);
  return (
    <SceneTransitionWipe transition="${blueprint.scenes[1].transitionIn}" durationInFrames={durationInFrames}>
      <SceneBackdrop variant="genome-alt" />
      <AbsoluteFill style={{ padding: ${pad}, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        ${headline ? '' : `<ChapterBadge sceneNumber={2} totalScenes={2} label="Kunci bertahan" variant="genome-alt" />
        <SceneHeadline title="3 kunci bertahan" variant="genome-alt" />`}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', width: '100%' }}>
          <RevealList items={['Konsisten tiap hari', 'Kenal pelanggan', 'Catat setiap angka']} revealFrames={[at('konsisten'), at('pelanggan'), at('angka')]} variant="genome-alt" />
        </div>
      </AbsoluteFill>
    </SceneTransitionWipe>
  );
};
`,
  });
  await w.writeComponentFile(buildMainComposition(blueprint, manifest, { captionMode: style.captionMode, avatar: false, brandFrame: style.layoutMode === 'evidence' || style.captionMode === 'headline', genome }));
  await w.finalizeProject(blueprint, storyboard.synopsis, style);
  console.log(`\n✅ ${outRel} ("${genome.name}") → npx remotion preview ${outRel}/index.ts`);
}

if (process.argv[1]?.includes("demo-genome")) main().catch((e) => {
  console.error(e);
  process.exit(1);
});
