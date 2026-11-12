import path from 'node:path';
import type { ModelConfig } from '../../llm/provider.js';
import type { LlmClient } from '../../llm/types.js';
import { createStageLlm } from '../../llm/factory.js';
import type { DirectorBlueprint, ChoreographedScenePlan } from '../../types/director.js';
import type { AssetManifest, GeneratedAudioAsset } from '../../types/asset.js';
import { SingleFileResultSchema, type SingleFileResult } from '../../types/code.js';
import { promptLoader } from '../../core/prompt-loader.js';
import { formatLandmarkCues } from '../bridge/audio-aligner.js';
import { describeStyleForPrompt, type StyleProfile } from '../../styles/presets.js';
import { isDarkWorld, type StyleGenome } from '../../styles/genome.js';

export interface CoderLayoutContext {
  avatar: boolean;
  userAssetsBrief: string;
}

/** Layout zones & rules that depend on caption mode / avatar / evidence layout */
export function buildLayoutBrief(style: StyleProfile | undefined, ctx: CoderLayoutContext, userAssetsImportPath: string): {
  brief: string;
  contentPadding: string;
  titleRule: string;
} {
  const headline = style?.captionMode === 'headline';
  const evidence = style?.layoutMode === 'evidence';
  const lines: string[] = ['LAYOUT NOTES:'];
  if (headline) {
    lines.push('- The top area is used by the headline captions; do not add a separate scene title.');
  }
  if (ctx.avatar) {
    lines.push('- The bottom-right area is used by the presenter avatar; keep scene content clear of it.');
  }
  if (evidence) {
    lines.push('- Evidence layout: elements appear on their beats and stay on screen. Only show data from the narration or user-provided facts.');
  }
  lines.push(`- User assets: \`import { USER_ASSETS } from '${userAssetsImportPath}';\``);
  lines.push(ctx.userAssetsBrief);
  const top = headline ? 480 : 86;
  const bottom = ctx.avatar || headline ? 600 : 330;
  return {
    brief: lines.join('\n'),
    contentPadding: `${top}px 56px ${bottom}px 56px`,
    titleRule: headline
      ? 'No ChapterBadge / SceneHeadline (the headline captions cover the title).'
      : 'Include `<ChapterBadge ... />` at the top and a title, then the scene content.',
  };
}

function formatBeatSchedule(scenePlan: ChoreographedScenePlan, fps: number): string {
  if (!scenePlan.beats || scenePlan.beats.length === 0) return '- (no beats)';
  return scenePlan.beats
    .map(
      (b, i) =>
        `- Beat ${i} @ local frame ${b.localFrame} (${(b.localFrame / fps).toFixed(1)}s)${b.anchorWord ? ` on "${b.anchorWord}"` : ''} [${b.action}, ${b.emphasis}]: ${b.visual}` +
        (b.onScreenText ? ` (sticker "${b.onScreenText}" is rendered by the FX layer)` : '')
    )
    .join('\n');
}

function getRelativeImportPath(fromFilePath: string, toFilePath: string): string {
  const fromDir = path.posix.dirname(fromFilePath.replace(/\\/g, '/'));
  const toWithoutExt = toFilePath.replace(/\\/g, '/').replace(/\.tsx?$|\.jsx?$/, '');
  let rel = path.posix.relative(fromDir, toWithoutExt);
  if (!rel.startsWith('.')) {
    rel = './' + rel;
  }
  return rel;
}

function sanitizeComponentCode(code: string): string {
  // Remove redundant `export { Foo };` if `export const Foo` or `export function Foo` already exists
  const exportDeclRegex = /export\s+(?:const|function|class)\s+([A-Za-z0-9_]+)/g;
  const declaredExports = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = exportDeclRegex.exec(code)) !== null) {
    declaredExports.add(match[1]);
  }

  let cleaned = code;
  for (const name of declaredExports) {
    const dupRegex = new RegExp(`^\\s*export\\s*\\{\\s*${name}\\s*\\}\\s*;?\\s*$`, 'gm');
    cleaned = cleaned.replace(dupRegex, '');
  }
  return cleaned.trimEnd() + '\n';
}

export class RemotionCoderAgent {
  private llm: LlmClient;

  constructor(modelConfig?: ModelConfig) {
    this.llm = createStageLlm('stage3-coder', modelConfig);
  }

  /**
   * LLM 3: Generates the ambient Background component via YAML prompt
   */
  async generateBackgroundComponent(blueprint: DirectorBlueprint, style?: StyleProfile): Promise<SingleFileResult> {
    console.log(`\n💻 [LLM 3: Coder] Writing Background (${blueprint.backgroundComponent.filePath})...`);

    const promptConfig = promptLoader.load('stage3-coder');
    const typesImportPath = getRelativeImportPath(blueprint.backgroundComponent.filePath, 'types.ts');
    const themeImportPath = getRelativeImportPath(blueprint.backgroundComponent.filePath, 'constants/theme.ts');

    const prompt = promptLoader.interpolate(
      promptConfig.background_prompt_template || 'Generate background for {{projectName}}',
      {
        projectName: blueprint.projectName,
        width: blueprint.width,
        height: blueprint.height,
        backgroundDescription: blueprint.backgroundComponent.description,
        styleBrief: style ? describeStyleForPrompt(style) : '',
        componentName: blueprint.backgroundComponent.componentName,
        filePath: blueprint.backgroundComponent.filePath,
        typesImportPath,
        themeImportPath,
        sharedTypesCode: blueprint.sharedTypesCode,
        sharedThemeCode: blueprint.sharedThemeCode,
      }
    );

    const response = await this.llm.generateStructured({
      system: promptConfig.system_prompt,
      user: prompt,
      schema: SingleFileResultSchema,
      schemaName: 'background_generator',
    });

    return {
      ...response,
      code: sanitizeComponentCode(response.code),
    };
  }

  /**
   * LLM 3: Generates a single Scene component via YAML prompt
   */
  async generateSceneComponent(
    scenePlan: ChoreographedScenePlan,
    blueprint: DirectorBlueprint,
    audioTrack?: GeneratedAudioAsset,
    style?: StyleProfile,
    layoutCtx: CoderLayoutContext = { avatar: false, userAssetsBrief: 'User-provided images: none.' }
  ): Promise<SingleFileResult> {
    console.log(
      `\n💻 [LLM 3: Coder] Writing Scene ${scenePlan.sceneNumber}: "${scenePlan.componentName}" [${scenePlan.visualStyleTag}] (${scenePlan.durationInFrames} frames)...`
    );

    const promptConfig = promptLoader.load('stage3-coder');
    const typesImportPath = getRelativeImportPath(scenePlan.filePath, 'types.ts');
    const themeImportPath = getRelativeImportPath(scenePlan.filePath, 'constants/theme.ts');
    const sceneCraftImportPath = getRelativeImportPath(scenePlan.filePath, 'components/common/SceneCraft.tsx');
    const beatsImportPath = getRelativeImportPath(scenePlan.filePath, 'constants/beats.ts');
    const userAssetsImportPath = getRelativeImportPath(scenePlan.filePath, 'constants/userAssets.ts');
    const genomeImportPath = getRelativeImportPath(scenePlan.filePath, 'constants/genome.ts');
    const layout = buildLayoutBrief(style, layoutCtx, userAssetsImportPath);
    const hasProps = scenePlan.expectedPropsInterface && scenePlan.expectedPropsInterface !== 'none';
    const propsTypeAnnotation = hasProps ? `Partial<${scenePlan.expectedPropsInterface}>` : '';
    const landmarkCues =
      audioTrack?.wordTimings && audioTrack.wordTimings.length > 0
        ? formatLandmarkCues(audioTrack.wordTimings)
        : 'Follow local frames 0..' + scenePlan.durationInFrames;

    const prompt = promptLoader.interpolate(
      promptConfig.scene_prompt_template || 'Generate scene for {{projectName}}',
      {
        projectName: blueprint.projectName,
        width: blueprint.width,
        height: blueprint.height,
        sceneNumber: scenePlan.sceneNumber,
        totalScenes: blueprint.scenes.length,
        componentName: scenePlan.componentName,
        filePath: scenePlan.filePath,
        visualStyleTag: scenePlan.visualStyleTag || 'flat-vector',
        transitionIn: scenePlan.transitionIn || 'wipe-right',
        durationInFrames: scenePlan.durationInFrames,
        captionText: scenePlan.captionText || '',
        landmarkCues,
        typesImportPath,
        themeImportPath,
        sceneCraftImportPath,
        sharedTypesCode: blueprint.sharedTypesCode,
        sharedThemeCode: blueprint.sharedThemeCode,
        expectedPropsInterface: scenePlan.expectedPropsInterface,
        propsTypeAnnotation,
        keyframeEvents: scenePlan.keyframeEvents.map((e) => `- ${e}`).join('\n'),
        visualElements: scenePlan.visualElements.map((v) => `- ${v}`).join('\n'),
        beatSchedule: formatBeatSchedule(scenePlan, blueprint.fps || 30),
        beatFrameList: JSON.stringify((scenePlan.beats || []).map((b) => b.localFrame)),
        beatsImportPath,
        styleBrief: style ? describeStyleForPrompt(style) : '',
        layoutBrief: layout.brief,
        genomeImportPath,
        contentPadding: layout.contentPadding,
        titleRule: layout.titleRule,
      }
    );

    const response = await this.llm.generateStructured({
      system: promptConfig.system_prompt,
      user: prompt,
      schema: SingleFileResultSchema,
      schemaName: 'scene_generator',
    });

    return {
      ...response,
      code: sanitizeComponentCode(response.code),
    };
  }

  /**
   * LLM 3 (Self-Repair): Fixes a single failing file using TypeScript compiler diagnostics
   */
  async repairFileComponent(
    filePath: string,
    currentCode: string,
    errors: string[],
    blueprint: DirectorBlueprint
  ): Promise<SingleFileResult> {
    console.log(`  🔧 [LLM 3: Repair] Fixing ${filePath} (${errors.length} error)...`);

    const promptConfig = promptLoader.load('stage3-coder');
    const typesImportPath = getRelativeImportPath(filePath, 'types.ts');
    const themeImportPath = getRelativeImportPath(filePath, 'constants/theme.ts');
    const sceneCraftImportPath = getRelativeImportPath(filePath, 'components/common/SceneCraft.tsx');
    const beatsImportPath = getRelativeImportPath(filePath, 'constants/beats.ts');
    const genomeImportPath = getRelativeImportPath(filePath, 'constants/genome.ts');

    const prompt = promptLoader.interpolate(
      promptConfig.repair_prompt_template || 'Fix TypeScript errors in {{filePath}}:\n{{compilerErrors}}\n\n{{currentCode}}',
      {
        projectName: blueprint.projectName,
        filePath,
        typesImportPath,
        themeImportPath,
        sceneCraftImportPath,
        beatsImportPath,
        genomeImportPath,
        sharedTypesCode: blueprint.sharedTypesCode,
        sharedThemeCode: blueprint.sharedThemeCode,
        currentCode,
        compilerErrors: errors.map((e) => `- ${e}`).join('\n'),
      }
    );

    const response = await this.llm.generateStructured({
      system: promptConfig.system_prompt,
      user: prompt,
      schema: SingleFileResultSchema,
      schemaName: 'component_repairer',
    });

    return {
      ...response,
      code: sanitizeComponentCode(response.code),
    };
  }

  /**
   * Orchestrates MainComposition.tsx (deterministic, no LLM)
   */
  generateMainComposition(blueprint: DirectorBlueprint, assetManifest?: AssetManifest, opts?: MainCompositionOptions): SingleFileResult {
    return buildMainComposition(blueprint, assetManifest, opts);
  }
}

/**
 * Builds MainComposition.tsx: scenes wrapped in BeatFX layers, captions, voiceover, SFX, music bed and progress bar.
 */
export interface MainCompositionOptions {
  captionMode?: 'pill' | 'headline';
  /** global presenter avatar (bottom-right) */
  avatar?: boolean;
  /** persistent brand frame (chapter label, REC counter, handle pill) */
  brandFrame?: boolean;
  /** active genome (decides dark/light for genome worlds) */
  genome?: StyleGenome;
}

export function buildMainComposition(blueprint: DirectorBlueprint, assetManifest?: AssetManifest, opts: MainCompositionOptions = {}): SingleFileResult {
  const headline = opts.captionMode === 'headline';
  const presenter = !!(opts.avatar || opts.brandFrame);
    const bgImportPath = getRelativeImportPath(blueprint.mainFilePath, blueprint.backgroundComponent.filePath);
  const bgImport = `import { ${blueprint.backgroundComponent.componentName} } from '${bgImportPath}';`;
  const captionsImportPath = getRelativeImportPath(blueprint.mainFilePath, 'components/common/KineticCaptions.tsx');
  const captionsImport = `import { KineticCaptions } from '${captionsImportPath}';`;
  const wordTimingsImportPath = getRelativeImportPath(blueprint.mainFilePath, 'constants/wordTimings.ts');
  const wordTimingsImport = `import { SCENE_WORD_TIMINGS } from '${wordTimingsImportPath}';`;

  const sceneImports = blueprint.scenes
    .map((s) => {
      const sceneImportPath = getRelativeImportPath(blueprint.mainFilePath, s.filePath);
      return `import { ${s.componentName} } from '${sceneImportPath}';`;
    })
    .join('\n');

  const audioImportLines: string[] = [];
  const sceneAudioVarByNumber = new Map<number, string>();

  if (assetManifest) {
    for (const s of blueprint.scenes) {
      const track = assetManifest.audioTracks.find((a) => a.sceneNumber === s.sceneNumber);
      if (track) {
        const audioVar = `scene${s.sceneNumber}Audio`;
        const audioImportPath = getRelativeImportPath(blueprint.mainFilePath, track.filePath);
        audioImportLines.push(`import ${audioVar} from '${audioImportPath}';`);
        sceneAudioVarByNumber.set(s.sceneNumber, audioVar);
      }
    }
  }

  const hasAnyAudio = sceneAudioVarByNumber.size > 0;
  const remotionImports = hasAnyAudio ? 'AbsoluteFill, Audio, Sequence' : 'AbsoluteFill, Sequence';
  const beatFxImportPath = getRelativeImportPath(blueprint.mainFilePath, 'components/common/BeatFX.tsx');
  const beatsImportPath = getRelativeImportPath(blueprint.mainFilePath, 'constants/beats.ts');

  const sceneSequences = blueprint.scenes
    .map((s) => {
      const audioVar = sceneAudioVarByNumber.get(s.sceneNumber);
      const audioTag = audioVar ? `\n        <Audio src={${audioVar}} />` : '';
      const captionTheme = s.captionTheme || 'light-pill';
      const captionTag = !s.captionText
        ? ''
        : headline
          ? `\n        <HeadlineCaptions wordTimings={SCENE_WORD_TIMINGS[${s.sceneNumber}] || []} highlightWords={SCENE_HIGHLIGHTS[${s.sceneNumber}] || []} theme="${isDarkWorld(s.visualStyleTag, opts.genome) ? 'dark' : 'light'}" markerColor={STYLE_FX.captionAccent} />`
          : `\n        <KineticCaptions text={${JSON.stringify(s.captionText)}} wordTimings={SCENE_WORD_TIMINGS[${s.sceneNumber}]} theme="${captionTheme}" accentColor={STYLE_FX.captionAccent}${opts.avatar ? ' insetRight={560}' : ''} />`;
      const beatsRef = `SCENE_BEATS[${s.sceneNumber}] || []`;
      return `      {/* Scene ${s.sceneNumber} (Frame ${s.startFrame} -> ${s.startFrame + s.durationInFrames}) */}
      <Sequence from={${s.startFrame}} durationInFrames={${s.durationInFrames}}>
        <BeatCamera beats={${beatsRef}} durationInFrames={${s.durationInFrames}}>
          <${s.componentName} />
        </BeatCamera>
        <BeatParticles beats={${beatsRef}} />
        <BeatFlash beats={${beatsRef}} />
        <BeatStickers beats={${beatsRef}} durationInFrames={${s.durationInFrames}} />${captionTag}
        <BeatSfx beats={${beatsRef}} />${audioTag}
      </Sequence>`;
    })
    .join('\n\n');

  const audioImportsBlock = audioImportLines.length > 0 ? `\n${audioImportLines.join('\n')}` : '';

  const code = `import React from 'react';
import { ${remotionImports} } from 'remotion';
${bgImport}
${captionsImport}
${wordTimingsImport}
import { BeatCamera, BeatFlash, BeatParticles, BeatSfx, BeatStickers, GlobalProgressBar, MusicBed } from '${beatFxImportPath}';
import { SCENE_BEATS, SCENE_HIGHLIGHTS, STYLE_FX } from '${beatsImportPath}';${headline ? `\nimport { HeadlineCaptions } from '${getRelativeImportPath(blueprint.mainFilePath, 'components/common/HeadlineCaptions.tsx')}';` : ''}${presenter ? `\nimport { BrandFrame, TalkingAvatar } from '${getRelativeImportPath(blueprint.mainFilePath, 'components/common/Presenter.tsx')}';` : ''}
${sceneImports}${audioImportsBlock}

export const ${blueprint.mainCompositionName}: React.FC = () => {
  return (
    <AbsoluteFill style={{ fontFamily: "'Plus Jakarta Sans', 'Space Grotesk', sans-serif", backgroundColor: STYLE_FX.palette.bg }}>
      {/* Background Layer: Active across entire video */}
      <Sequence from={0} durationInFrames={${blueprint.totalDurationInFrames}}>
        <${blueprint.backgroundComponent.componentName} />
      </Sequence>

      {/* Scenes wrapped in the deterministic BeatFX layer (camera punch-cuts, stickers, flashes, SFX every beat) */}
${sceneSequences}

      {/* Global layers */}${opts.avatar ? '\n      <TalkingAvatar />' : ''}${presenter ? '\n      <BrandFrame />' : ''}
      <GlobalProgressBar durationInFrames={${blueprint.totalDurationInFrames}} />
      <MusicBed durationInFrames={${blueprint.totalDurationInFrames}} />
    </AbsoluteFill>
  );
};
`;

  return {
    filePath: blueprint.mainFilePath,
    code,
    exportedSymbols: [blueprint.mainCompositionName],
    notes: 'Master Sequence orchestrating background and all timed scenes',
  };
}
