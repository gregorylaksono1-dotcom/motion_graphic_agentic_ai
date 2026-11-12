import 'dotenv/config';
import fsSync from 'node:fs';
import path from 'node:path';
import { buildStyleProfile } from './styles/presets.js';
import { AssetGenerationManager } from './stages/stage1b-asset-gen/asset-manager.js';
import { bridgeStoryboardTiming } from './stages/bridge/timing.js';
import { enforceBlueprint } from './stages/stage2-director/beat-enforcer.js';
import { buildMainComposition } from './stages/stage3-coder/agent.js';
import { RemotionProjectWriter } from './generator/writer.js';
import { loadAvatarPack } from './avatar/avatar-pack.js';
import type { StoryboardPlan, SceneScript } from './types/story.js';
import type { DirectorBlueprint, DirectorBeat } from './types/director.js';

/**
 * Offline demo of the "evidence-story" preset (no LLM calls, dummy TTS):
 * word-anchored beats, headline captions, evidence kit, brand frame and talking avatar.
 *
 *   npm run demo:evidence                      -> output-evidence/ (no avatar by default)
 *   npm run demo:evidence -- --avatar=<pack-name> --handle=@yourhandle
 *   npx remotion preview output-evidence/index.ts
 *
 * NOTE: all names / numbers below are fictional DEMO data. In real runs they must come from --assets (facts.md / screenshots).
 */
async function main() {
  const args = process.argv.slice(2);
  const outRel = args.find((a) => a.startsWith('--out='))?.slice(6) || 'output-evidence';
  const avatarArg = args.find((a) => a.startsWith('--avatar='))?.slice(9) ?? 'none';
  const handle = args.find((a) => a.startsWith('--handle='))?.slice(9) ?? '@yourhandle';
  const outputDir = path.resolve(process.cwd(), outRel);
  const avatar =
    avatarArg !== 'none' && fsSync.existsSync(path.resolve('library/avatar', avatarArg, 'avatar.json')) ? loadAvatarPack(avatarArg) : null;

  const style = buildStyleProfile('evidence-story', { source: 'user', reasoning: 'demo' });
  const voice = (text: string): SceneScript['ttsVoiceover'] => ({
    spokenText: text,
    voiceGender: 'male',
    voiceTone: 'enthusiastic',
    voiceSpeed: 1.08,
    emotion: 'urgent',
    geminiVoiceName: 'Puck',
    soundEffectsCue: [],
  });
  const storyboard: StoryboardPlan = {
    title: 'Laporan Penjualan Demo',
    synopsis: 'Demo evidence-story (data fiktif): pesanan toko online dari 6 kota, satu produk terjual 296 kali, stok tetap aman.',
    visualStyle: style.label,
    targetAudience: 'pemilik bisnis online',
    chapterLabel: 'LAPORAN PENJUALAN · EP 01',
    cornerLabel: 'DATA',
    scenes: [
      {
        sceneNumber: 1,
        sceneTitle: 'Pesanan dari 6 kota',
        visualStyleTag: 'halftone-navy',
        ttsVoiceover: voice('Toko online kami dapat pesanan dari 6 kota, cuma dalam 4 hari. Jakarta, Bandung, Surabaya, Medan, Makassar, bahkan dari Jayapura.'),
        visualConcept: 'Order table window, then city chips',
        keyVisualAction: 'Chips pop in as each city is named',
        visualBeats: [],
        characters: [],
        requiredMcpTools: [],
        mood: 'serious',
      },
      {
        sceneNumber: 2,
        sceneTitle: 'Produk terlaris',
        visualStyleTag: 'paper-file',
        ttsVoiceover: voice('Satu produk terjual 296 kali. Cuma 7 hari. Terus, kenapa stoknya tetap aman?'),
        visualConcept: 'Product card with counter, then status card',
        keyVisualAction: 'Counter runs to 296, card highlights',
        visualBeats: [],
        characters: [],
        requiredMcpTools: [],
        mood: 'serious',
      },
    ],
  };

  const assetManager = new AssetGenerationManager(outRel, { ttsMode: 'dummy' });
  const manifest = await assetManager.generateAssets(storyboard, [], 30);
  const timed = bridgeStoryboardTiming(storyboard, 30, manifest, style.pacing.beatIntervalSec);

  const beat = (anchorWord: string, action: DirectorBeat['action'], visual: string, extra: Partial<DirectorBeat> = {}): DirectorBeat => ({
    localFrame: 0,
    anchorWord,
    action,
    visual,
    onScreenText: '',
    emphasis: 'medium',
    sfx: 'none',
    avatarPose: '',
    ...extra,
  });

  const draft: DirectorBlueprint = {
    projectName: 'SalesReportDemo',
    mainCompositionName: 'MainComposition',
    mainFilePath: 'components/MainComposition.tsx',
    width: 1080,
    height: 1920,
    fps: 30,
    totalDurationInFrames: timed.totalDurationInFrames,
    sharedTypesCode: `export interface SceneProps { durationInFrames?: number }\n`,
    sharedThemeCode: `export const THEME = { colors: ${JSON.stringify(style.palette)} };\n`,
    backgroundComponent: { componentName: 'BackgroundLayer', filePath: 'components/common/BackgroundLayer.tsx', description: 'navy' },
    directorNotes: 'demo',
    scenes: [
      {
        sceneNumber: 1,
        componentName: 'Scene1Pesanan',
        filePath: '',
        visualStyleTag: 'halftone-navy',
        transitionIn: 'fade',
        captionTheme: 'light-pill',
        startFrame: 0,
        durationInFrames: 0,
        captionText: '',
        expectedPropsInterface: 'SceneProps',
        keyframeEvents: [],
        visualElements: [],
        highlightWords: ['pesanan', '6', 'Jayapura'],
        beats: [
          beat('Toko', 'element-enter', 'Order table window slides up', { avatarPose: 'menjelaskan', sfx: 'swoosh-soft' }),
          beat('pesanan', 'highlight', 'Latest order row highlights', { sfx: 'click' }),
          beat('6', 'text-slam', 'Stamp 6 KOTA', { onScreenText: '6 KOTA', emphasis: 'high', sfx: 'impact', avatarPose: 'kaget' }),
          beat('4', 'element-enter', 'Date tag 4 HARI', { sfx: 'pop' }),
          beat('Jakarta', 'visual-swap', 'Window out, chip Jakarta in', { avatarPose: 'menunjuk', sfx: 'pop' }),
          beat('Bandung', 'element-enter', 'Chip Bandung', { sfx: 'pop' }),
          beat('Surabaya', 'element-enter', 'Chip Surabaya', { sfx: 'pop' }),
          beat('Medan', 'element-enter', 'Chip Medan', { sfx: 'pop' }),
          beat('Makassar', 'element-enter', 'Chip Makassar', { sfx: 'pop' }),
          beat('Jayapura', 'highlight', 'Chip Jayapura highlighted', { emphasis: 'high', sfx: 'impact', avatarPose: 'kaget' }),
        ],
      },
      {
        sceneNumber: 2,
        componentName: 'Scene2Terlaris',
        filePath: '',
        visualStyleTag: 'paper-file',
        transitionIn: 'zoom-focus',
        captionTheme: 'light-pill',
        startFrame: 0,
        durationInFrames: 0,
        captionText: '',
        expectedPropsInterface: 'SceneProps',
        keyframeEvents: [],
        visualElements: [],
        highlightWords: ['produk', '296', 'aman'],
        beats: [
          beat('Satu', 'element-enter', 'Ruled chart draws in', { sfx: 'whoosh', avatarPose: 'menjelaskan' }),
          beat('produk', 'element-enter', 'Product card', { sfx: 'pop', avatarPose: 'menunjuk' }),
          beat('terjual', 'highlight', 'Card highlights', { sfx: 'impact', emphasis: 'high' }),
          beat('296', 'counter', 'Counter to 296', { sfx: 'click', emphasis: 'high', avatarPose: 'kaget' }),
          beat('7', 'text-slam', 'Stamp 7 HARI', { onScreenText: '7 HARI', emphasis: 'high', sfx: 'impact' }),
          beat('Terus', 'visual-swap', 'Swap to status card', { sfx: 'swoosh-soft', avatarPose: 'berpikir' }),
          beat('aman', 'element-enter', 'Stock status card', { sfx: 'ding', avatarPose: 'jempol' }),
        ],
      },
    ],
  };

  const blueprint = enforceBlueprint(draft, timed, style, {
    avatarPoses: avatar ? avatar.poses.map((p) => ({ id: p.id, hint: p.hint })) : undefined,
  });
  blueprint.scenes = blueprint.scenes.map((s, i) => ({ ...s, componentName: draft.scenes[i].componentName, filePath: `components/scenes/${draft.scenes[i].componentName}.tsx` }));

  const writer = new RemotionProjectWriter(outRel);
  await writer.cleanComponentsDir();
  await writer.writeContractFiles(blueprint);
  await writer.writeWordTimingsFile(blueprint, manifest);
  await writer.writeKineticCaptionsComponent();
  await writer.writeSceneCraftComponent();
  await writer.writeBeatsFile(blueprint, style);
  await writer.writeBeatFxLayer(style);
  await writer.writeHeadlineCaptionsComponent();
  await writer.writeUserAssetsFile();
  await writer.writePresenterLayer(blueprint, { chapterLabel: storyboard.chapterLabel, cornerLabel: storyboard.cornerLabel, handle, enabled: true }, avatar, manifest);

  await writer.writeComponentFile({
    filePath: 'components/common/BackgroundLayer.tsx',
    exportedSymbols: ['BackgroundLayer'],
    notes: '',
    code: `import React from 'react';\nimport { AbsoluteFill } from 'remotion';\n\nexport const BackgroundLayer: React.FC = () => <AbsoluteFill style={{ backgroundColor: '#1B2453' }} />;\n`,
  });

  // --- Scene components (what the Stage 3 coder is prompted to produce) ---
  await writer.writeComponentFile({
    filePath: 'components/scenes/Scene1Pesanan.tsx',
    exportedSymbols: ['Scene1Pesanan'],
    notes: '',
    code: `import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { SceneBackdrop, SceneTransitionWipe, EvidenceWindow, TagLabel, ChipGrid } from '../common/SceneCraft';
import { anchorFrame } from '../../constants/beats';

const ROWS = [
  ['#1001 · Jakarta', 'Tumbler 500ml', 'paid'],
  ['#1002 · Bandung', 'Tote bag', 'paid'],
  ['#1003 · Surabaya', 'Tumbler 500ml', 'paid'],
  ['#1004 · Medan', 'Notebook A5', 'paid'],
  ['#1005 · Makassar', 'Tumbler 500ml', 'paid'],
  ['#1006 · Jayapura', 'Sticker pack', 'paid'],
  ['#1007 · Jakarta', 'Tumbler 500ml', 'new'],
];

export const Scene1Pesanan: React.FC<{ durationInFrames?: number }> = ({ durationInFrames = ${blueprint.scenes[0].durationInFrames} }) => {
  const frame = useCurrentFrame();
  const at = (w: string, fb = 0) => anchorFrame(1, w, fb);
  const swap = at('Jakarta', 9999);
  const windowOut = interpolate(frame, [swap - 6, swap], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const cities = ['Jakarta', 'Bandung', 'Surabaya', 'Medan', 'Makassar', 'Jayapura'];
  const subs = ['82 pesanan', '41 pesanan', '37 pesanan', '19 pesanan', '12 pesanan', '3 pesanan'];
  return (
    <SceneTransitionWipe transition="fade" durationInFrames={durationInFrames}>
      <SceneBackdrop variant="halftone-navy" />
      <AbsoluteFill style={{ padding: '480px 56px 600px 56px', boxSizing: 'border-box' }}>
        {frame < swap && (
          <div style={{ opacity: windowOut, transform: 'translateY(' + (1 - windowOut) * -40 + 'px)' }}>
            <EvidenceWindow title="Dashboard · Orders" tag="DATA DEMO" startFrame={at('Toko')} rows={ROWS} highlightRow={6} highlightFrame={at('pesanan')} height={500} />
            <div style={{ marginTop: 34 }}>
              <TagLabel text="4 HARI · DATA DEMO" tone="yellow" startFrame={at('4')} fontSize={30} />
            </div>
          </div>
        )}
        {frame >= swap - 1 && (
          <ChipGrid
            items={cities.map((c, i) => ({ title: c, subtitle: subs[i], highlight: c === 'Jayapura' }))}
            revealFrames={cities.map((c) => at(c, swap))}
          />
        )}
      </AbsoluteFill>
    </SceneTransitionWipe>
  );
};
`,
  });

  await writer.writeComponentFile({
    filePath: 'components/scenes/Scene2Terlaris.tsx',
    exportedSymbols: ['Scene2Terlaris'],
    notes: '',
    code: `import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { SceneBackdrop, SceneTransitionWipe, RuledChart, InfoCard, StatCounter, StatusCard } from '../common/SceneCraft';
import { anchorFrame } from '../../constants/beats';

export const Scene2Terlaris: React.FC<{ durationInFrames?: number }> = ({ durationInFrames = ${blueprint.scenes[1].durationInFrames} }) => {
  const frame = useCurrentFrame();
  const at = (w: string, fb = 0) => anchorFrame(2, w, fb);
  const swap = at('Terus', 9999);
  return (
    <SceneTransitionWipe transition="zoom-focus" durationInFrames={durationInFrames}>
      <SceneBackdrop variant="paper-file" />
      <AbsoluteFill style={{ padding: '480px 56px 600px 56px', boxSizing: 'border-box' }}>
        {frame < swap ? (
          <div style={{ position: 'relative' }}>
            <RuledChart startFrame={at('Satu')} labels={['300', '200', '100']} height={520} />
            <div style={{ position: 'absolute', left: 36, top: 24 }}>
              <InfoCard kicker="Produk terlaris" value="Tumbler 500ml" caption="SKU-0001" startFrame={at('produk')} alertFrame={at('terjual')} />
            </div>
            <div style={{ position: 'absolute', left: 36, top: 300 }}>
              <StatCounter to={296} startFrame={at('296')} durationFrames={16} color="#E11D48" fontSize={150} label="kali terjual" labelPosition="right" variant="paper-file" />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
            <StatusCard kicker="Stok gudang" title="tetap aman" status="READY" startFrame={at('aman', swap + 10)} />
          </div>
        )}
      </AbsoluteFill>
    </SceneTransitionWipe>
  );
};
`,
  });

  await writer.writeComponentFile(buildMainComposition(blueprint, manifest, { captionMode: 'headline', avatar: !!avatar, brandFrame: true, genome: style.genome }));
  await writer.finalizeProject(blueprint, storyboard.synopsis, style);
  console.log(`\n✅ Evidence demo ready at ${outRel}/  →  npx remotion preview ${outRel}/index.ts`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
