import fs from 'node:fs/promises';
import path from 'node:path';
import type { DirectorBlueprint } from '../types/director.js';
import type { SingleFileResult } from '../types/code.js';
import type { AssetManifest, WordTiming } from '../types/asset.js';
import { alignWordsEstimated } from '../stages/bridge/audio-aligner.js';
import { buildSceneCraftCode } from './scene-craft.js';
import { buildBeatFxCode, stickerVariantFor } from './beat-fx.js';
import { writeSfxAssets, prepareMusicBed } from './audio-fx.js';
import type { StyleProfile } from '../styles/presets.js';
import { genomeToTokens, isDarkWorld, luminance, FONT_CATALOG, type StyleGenome } from '../styles/genome.js';
import { buildHeadlineCaptionsCode } from './headline-captions.js';
import { buildPresenterCode, buildPresenterConstants, type BrandConfig } from './presenter.js';
import { copyAvatarAssets, type AvatarPack } from '../avatar/avatar-pack.js';
import { buildVisemeTrack, type VisemeTrack } from '../avatar/visemes.js';
import type { UserAssetBundle } from '../assets/user-assets.js';

/** Worlds whose backdrop is dark (light text on top) */
export const DARK_WORLDS = new Set(['halftone-navy', 'chalkboard', 'glow-sketch', 'dan-koe', 'cgi-motion']);

export class RemotionProjectWriter {
  private baseDir: string;
  private genomeFonts: string[] = [];
  private genome: StyleGenome | null = null;

  constructor(outputDir: string = './output') {
    this.baseDir = path.resolve(process.cwd(), outputDir);
  }

  getBaseDir(): string {
    return this.baseDir;
  }

  /**
   * Membaca isi file yang sudah ditulis (untuk kebutuhan repair loop)
   */
  async readComponentFile(relativePath: string): Promise<string> {
    const fullPath = path.join(this.baseDir, relativePath);
    return fs.readFile(fullPath, 'utf-8');
  }

  /**
   * Membersihkan komponen hasil generate sebelumnya agar tidak bentrok saat tsc check
   */
  async cleanComponentsDir(): Promise<void> {
    const componentsDir = path.join(this.baseDir, 'components');
    await fs.rm(componentsDir, { recursive: true, force: true });
  }

  /**
   * Menulis file kontrak bersama: types.ts & constants/theme.ts
   */
  async writeContractFiles(blueprint: DirectorBlueprint): Promise<{ typesPath: string; themePath: string }> {
    await fs.mkdir(this.baseDir, { recursive: true });

    // 1. types.ts
    const typesPath = path.join(this.baseDir, 'types.ts');
    await fs.writeFile(typesPath, blueprint.sharedTypesCode, 'utf-8');
    console.log(`[Writer] 📜 Saved Contract: types.ts`);

    // 2. constants/theme.ts
    const themeDir = path.join(this.baseDir, 'constants');
    await fs.mkdir(themeDir, { recursive: true });
    const themePath = path.join(themeDir, 'theme.ts');
    await fs.writeFile(themePath, blueprint.sharedThemeCode, 'utf-8');
    console.log(`[Writer] 🎨 Saved Contract: constants/theme.ts`);

    return { typesPath, themePath };
  }

  /**
   * Menulis komponen individual (.tsx) ke dalam foldernya
   */
  async writeComponentFile(file: SingleFileResult): Promise<string> {
    const fullPath = path.join(this.baseDir, file.filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, file.code, 'utf-8');
    console.log(`[Writer] 💾 Saved: ${file.filePath}`);
    return fullPath;
  }

  /**
   * Menulis library komponen motion graphic reusable (SceneCraft.tsx) terinspirasi dari style editorial/vector/soft-3d/chalkboard/comic
   */
  async writeSceneCraftComponent(): Promise<string> {
    const relPath = 'components/common/SceneCraft.tsx';
    const fullPath = path.join(this.baseDir, relPath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buildSceneCraftCode(), 'utf-8');
    console.log(`[Writer] 🎨 Saved Shared Motion Craft Library: ${relPath}`);
    return relPath;
  }

  /**
   * Menulis constants/beats.ts: beat schedule per scene + style FX tokens (dibaca oleh BeatFX & KineticCaptions)
   */
  async writeBeatsFile(blueprint: DirectorBlueprint, style: StyleProfile): Promise<string> {
    const relPath = 'constants/beats.ts';
    const fullPath = path.join(this.baseDir, relPath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    const beatsByScene: Record<number, unknown[]> = {};
    for (const scene of blueprint.scenes) {
      beatsByScene[scene.sceneNumber] = (scene.beats || []).map((b) => ({
        localFrame: b.localFrame,
        action: b.action,
        emphasis: b.emphasis,
        sfx: b.sfx,
        onScreenText: b.onScreenText,
        anchorWord: b.anchorWord || '',
      }));
    }

    const darkWorld = luminance(style.genome.palette.bg) < 0.35;
    const styleFx = {
      presetId: style.id,
      cameraIntensity: style.pacing.cameraIntensity,
      beatIntervalSec: style.pacing.beatIntervalSec,
      stickerVariant: stickerVariantFor(style.id, style.genome.sticker),
      cameraMode: style.genome.motion.cameraMode,
      particles: style.layoutMode !== 'evidence',
      captionMode: style.captionMode || 'pill',
      layoutMode: style.layoutMode || 'standard',
      flashOpacity: style.layoutMode === 'evidence' ? 0.1 : darkWorld ? 0.28 : 0.18,
      sfxVolume: style.sfxPack === 'soft' ? 0.7 : style.sfxPack === 'cinematic' ? 0.9 : 1,
      musicVolume: 0.1,
      captionAccent: style.captionAccent,
      palette: style.palette,
    };

    const code = `// Auto-generated: beat schedule (≈ every ${style.pacing.beatIntervalSec}s) + style FX tokens
export type BeatAction =
  | 'element-enter' | 'visual-swap' | 'text-slam' | 'counter' | 'highlight'
  | 'reveal' | 'burst' | 'character-react' | 'camera-punch' | 'shake';

export interface SceneBeat {
  localFrame: number;
  action: BeatAction;
  emphasis: 'low' | 'medium' | 'high';
  sfx: 'whoosh' | 'pop' | 'click' | 'impact' | 'riser' | 'ding' | 'swoosh-soft' | 'none';
  onScreenText: string;
  anchorWord: string;
}

export const SCENE_BEATS: Record<number, SceneBeat[]> = ${JSON.stringify(beatsByScene, null, 2)};

export interface StyleFx {
  presetId: string;
  cameraIntensity: 'subtle' | 'medium' | 'punchy';
  beatIntervalSec: number;
  stickerVariant: 'pill' | 'glow' | 'outline' | 'stamp' | 'tape';
  cameraMode: 'punch' | 'drift';
  particles: boolean;
  captionMode: 'pill' | 'headline';
  layoutMode: 'standard' | 'evidence';
  flashOpacity: number;
  sfxVolume: number;
  musicVolume: number;
  captionAccent: string;
  palette: { bg: string; surface: string; primary: string; secondary: string; accent: string; text: string; textMuted: string };
}

export const STYLE_FX: StyleFx = ${JSON.stringify(styleFx, null, 2)};

/** Key words painted with the marker in HeadlineCaptions (numbers are highlighted automatically) */
export const SCENE_HIGHLIGHTS: Record<number, string[]> = ${JSON.stringify(
      Object.fromEntries(blueprint.scenes.map((s) => [s.sceneNumber, s.highlightWords || []])),
      null,
      2
    )};

/** Local beat frames for a scene — handy for syncing scene animations to beats */
export const beatFrames = (sceneNumber: number): number[] => (SCENE_BEATS[sceneNumber] || []).map((b) => b.localFrame);

const normWord = (w: string) => w.toLowerCase().replace(/(\\d)[.,](\\d)/g, '$1$2').replace(/[^\\p{L}\\p{N}%]/gu, '');

/** LOCAL frame of the beat anchored to a spoken word (exact audio timing). Falls back to \`fallback\` if not found. */
export const anchorFrame = (sceneNumber: number, word: string, fallback = 0): number => {
  const target = normWord(word);
  const hit = (SCENE_BEATS[sceneNumber] || []).find((b) => normWord(b.anchorWord) === target);
  return hit ? hit.localFrame : fallback;
};
`;
    await fs.writeFile(fullPath, code, 'utf-8');
    console.log(`[Writer] 🥁 Saved Beat Schedule: ${relPath}`);
    await this.writeGenomeFile(style.genome);
    return relPath;
  }

  /** constants/genome.ts — render tokens of the active Style Genome (read by SceneCraft, captions, BeatFX, presenter) */
  async writeGenomeFile(genome: StyleGenome): Promise<string> {
    const relPath = 'constants/genome.ts';
    await fs.mkdir(path.join(this.baseDir, 'constants'), { recursive: true });
    const tokens = genomeToTokens(genome);
    const code = `// Auto-generated: Style Genome "${genome.name}" — ${genome.rationale.replace(/\n/g, ' ')}
export const GENOME = ${JSON.stringify(genome, null, 2)};

export const TOKENS = ${JSON.stringify(tokens, null, 2)};

/** rgba() from a #RRGGBB token */
export const hexA = (hex: string, a: number): string => {
  const v = parseInt(hex.replace('#', ''), 16);
  return 'rgba(' + ((v >> 16) & 255) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + a + ')';
};
`;
    await fs.writeFile(path.join(this.baseDir, relPath), code, 'utf-8');
    console.log(`[Writer] 🧬 Saved Style Genome tokens: ${relPath} ("${genome.name}")`);
    this.genomeFonts = [genome.fonts.display, genome.fonts.body, genome.fonts.mono];
    this.genome = genome;
    return relPath;
  }

  /**
   * Menulis SFX (sintesis / library) + music bed, lalu komponen BeatFX.tsx yang mengimpornya
   */
  async writeBeatFxLayer(style: StyleProfile): Promise<{ beatFxPath: string; musicFile?: string }> {
    const sfxIds = await writeSfxAssets(this.baseDir);
    const musicFile = await prepareMusicBed(this.baseDir, style);
    const relPath = 'components/common/BeatFX.tsx';
    const fullPath = path.join(this.baseDir, relPath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buildBeatFxCode({ sfxIds, musicFile }), 'utf-8');
    console.log(`[Writer] 🎬 Saved Beat FX Layer: ${relPath}`);
    return { beatFxPath: relPath, musicFile };
  }

  /** Word timings per scene: real (aligned WAV) when available, otherwise estimated from the caption text */
  resolveSceneWordTimings(blueprint: DirectorBlueprint, assetManifest?: AssetManifest): Record<number, WordTiming[]> {
    const out: Record<number, WordTiming[]> = {};
    for (const scene of blueprint.scenes) {
      const track = assetManifest?.audioTracks.find((a) => a.sceneNumber === scene.sceneNumber);
      out[scene.sceneNumber] =
        track?.wordTimings && track.wordTimings.length > 0
          ? track.wordTimings
          : alignWordsEstimated(scene.captionText || '', scene.durationInFrames / (blueprint.fps || 30), blueprint.fps || 30);
    }
    return out;
  }

  async writeHeadlineCaptionsComponent(): Promise<string> {
    const relPath = 'components/common/HeadlineCaptions.tsx';
    const fullPath = path.join(this.baseDir, relPath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buildHeadlineCaptionsCode(), 'utf-8');
    console.log(`[Writer] 📰 Saved Headline Captions: ${relPath}`);
    return relPath;
  }

  /**
   * Brand frame + talking avatar: copies avatar PNGs, builds the global pose track (from beats)
   * and the viseme track (text + loudness), writes constants/presenter.ts and components/common/Presenter.tsx.
   */
  async writePresenterLayer(
    blueprint: DirectorBlueprint,
    brand: Omit<BrandConfig, 'sceneThemes' | 'sceneStarts' | 'totalScenes'>,
    avatar: AvatarPack | null,
    assetManifest?: AssetManifest
  ): Promise<string[]> {
    const fps = blueprint.fps || 30;
    const fullBrand: BrandConfig = {
      ...brand,
      totalScenes: blueprint.scenes.length,
      sceneThemes: Object.fromEntries(
        blueprint.scenes.map((s) => [s.sceneNumber, isDarkWorld(s.visualStyleTag, this.genome) ? 'dark' : 'light'])
      ) as Record<number, 'dark' | 'light'>,
      sceneStarts: blueprint.scenes.map((s) => [s.sceneNumber, s.startFrame] as [number, number]),
    };

    let avatarData: Parameters<typeof buildPresenterConstants>[1] = null;
    if (avatar) {
      const assetPaths = await copyAvatarAssets(avatar, this.baseDir);
      const timings = this.resolveSceneWordTimings(blueprint, assetManifest);
      const poses: Array<[number, string]> = [];
      const visemes: VisemeTrack = [];
      for (const scene of blueprint.scenes) {
        for (const b of scene.beats || []) {
          if (b.avatarPose) poses.push([scene.startFrame + b.localFrame, b.avatarPose]);
        }
        const track = assetManifest?.audioTracks.find((a) => a.sceneNumber === scene.sceneNumber);
        const local = buildVisemeTrack(timings[scene.sceneNumber] || [], scene.durationInFrames, fps, track?.absolutePath);
        for (const [f, v] of local) {
          if (visemes.length === 0 || visemes[visemes.length - 1][1] !== v) visemes.push([scene.startFrame + f, v]);
        }
      }
      poses.sort((a, b) => a[0] - b[0]);
      const dedupedPoses = poses.filter((p, i) => i === 0 || p[1] !== poses[i - 1][1]);
      poses.length = 0;
      poses.push(...dedupedPoses);
      avatarData = { pack: avatar, assetPaths, tracks: { poses, visemes } };
      console.log(`[Writer] 🧑‍🎤 Avatar "${avatar.id}": ${poses.length} pose switches, ${visemes.length} mouth changes`);
    }

    const constPath = 'constants/presenter.ts';
    const compPath = 'components/common/Presenter.tsx';
    await fs.mkdir(path.join(this.baseDir, 'constants'), { recursive: true });
    await fs.mkdir(path.join(this.baseDir, 'components/common'), { recursive: true });
    await fs.writeFile(path.join(this.baseDir, constPath), buildPresenterConstants(fullBrand, avatarData), 'utf-8');
    await fs.writeFile(path.join(this.baseDir, compPath), buildPresenterCode(), 'utf-8');
    return [constPath, compPath];
  }

  /** constants/userAssets.ts — static imports of user-provided images, keyed by file name */
  async writeUserAssetsFile(bundle?: UserAssetBundle): Promise<string> {
    const relPath = 'constants/userAssets.ts';
    const imgs = bundle?.images || [];
    const code = `// Auto-generated: user-provided assets (real screenshots / photos). Keys = file names.
${imgs.map((img, i) => `import ua_${i} from '../${img.relPath}';`).join('\n')}

export const USER_ASSETS: Record<string, string> = {
${imgs.map((img, i) => `  ${JSON.stringify(img.key)}: ua_${i},`).join('\n')}
};
`;
    await fs.mkdir(path.join(this.baseDir, 'constants'), { recursive: true });
    await fs.writeFile(path.join(this.baseDir, relPath), code, 'utf-8');
    return relPath;
  }

  /**
   * Menulis data word-level timestamps per scene ke constants/wordTimings.ts agar subtitle sinkron frame-by-frame
   */
  async writeWordTimingsFile(
    blueprint: DirectorBlueprint,
    assetManifest?: AssetManifest
  ): Promise<string> {
    const relPath = 'constants/wordTimings.ts';
    const fullPath = path.join(this.baseDir, relPath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    const timingsByScene: Record<number, WordTiming[]> = {};
    for (const scene of blueprint.scenes) {
      const track = assetManifest?.audioTracks.find((a) => a.sceneNumber === scene.sceneNumber);
      if (track?.wordTimings && track.wordTimings.length > 0) {
        timingsByScene[scene.sceneNumber] = track.wordTimings;
      } else {
        const durSec = scene.durationInFrames / (blueprint.fps || 30);
        timingsByScene[scene.sceneNumber] = alignWordsEstimated(
          scene.captionText || '',
          durSec,
          blueprint.fps || 30
        );
      }
    }

    const code = `export interface WordTiming {
  word: string;
  startSec: number;
  endSec: number;
  startFrame: number;
  endFrame: number;
  clauseBreakAfter?: boolean;
}

export const SCENE_WORD_TIMINGS: Record<number, WordTiming[]> = ${JSON.stringify(timingsByScene, null, 2)};
`;

    await fs.writeFile(fullPath, code, 'utf-8');
    console.log(`[Writer] ⏱️ Saved Audio-Synced Word Timings: ${relPath}`);
    return relPath;
  }

  /**
   * Menulis komponen KineticCaptions standar yang sinkron dengan wordTimings WAV & anti-overflow
   */
  async writeKineticCaptionsComponent(): Promise<string> {
    const captionsRelPath = 'components/common/KineticCaptions.tsx';
    const fullPath = path.join(this.baseDir, captionsRelPath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    const code = `import React, { useMemo } from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { TOKENS } from '../../constants/genome';

export interface WordTiming {
  word: string;
  startSec: number;
  endSec: number;
  startFrame: number;
  endFrame: number;
  clauseBreakAfter?: boolean;
}

export interface KineticCaptionsProps {
  text: string;
  wordTimings?: WordTiming[];
  accentColor?: string;
  theme?: 'light-pill' | 'dark-pill' | 'brutal-pill';
  wordsPerChunk?: number;
  /** extra right padding (e.g. when a presenter avatar sits bottom-right) */
  insetRight?: number;
}

interface CaptionChunk {
  words: WordTiming[];
  startFrame: number;
  endFrame: number;
}

function buildFallbackTimings(text: string, durationInFrames: number, fps: number): WordTiming[] {
  const tokens = (text || '').trim().split(/\\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const weights = tokens.map((w) => {
    const vowels = (w.match(/[aiueoyAIUEOY]+/g) || []).length;
    const syllables = Math.max(1, vowels);
    const pause = /[.!?;:—–]$/.test(w) ? 1.1 : /[,:]$/.test(w) ? 0.55 : 0;
    return 0.45 + syllables * 0.75 + pause;
  });

  const lead = Math.min(8, Math.floor(durationInFrames * 0.04));
  const tail = Math.min(10, Math.floor(durationInFrames * 0.05));
  const span = Math.max(10, durationInFrames - lead - tail);
  const totalW = weights.reduce((a, b) => a + b, 0) || tokens.length;

  let cursor = lead;
  return tokens.map((word, idx) => {
    const share = (weights[idx] / totalW) * span;
    const startFrame = Math.round(cursor);
    const endFrame = idx === tokens.length - 1 ? lead + span : Math.max(startFrame + 1, Math.round(cursor + share));
    cursor += share;
    return {
      word,
      startSec: startFrame / fps,
      endSec: endFrame / fps,
      startFrame,
      endFrame: Math.max(startFrame + 1, endFrame),
      clauseBreakAfter: /[.,!?;:—–]$/.test(word),
    };
  });
}

function groupIntoPhraseChunks(timings: WordTiming[], maxWords: number): CaptionChunk[] {
  const chunks: CaptionChunk[] = [];
  let buf: WordTiming[] = [];

  for (let i = 0; i < timings.length; i++) {
    const wt = timings[i];
    buf.push(wt);

    const charLen = buf.reduce((s, item) => s + item.word.length + 1, 0);
    const hitLimit = buf.length >= maxWords || charLen >= 26;
    const isLast = i === timings.length - 1;

    if (wt.clauseBreakAfter || hitLimit || isLast) {
      chunks.push({
        words: buf,
        startFrame: buf[0].startFrame,
        endFrame: buf[buf.length - 1].endFrame,
      });
      buf = [];
    }
  }

  return chunks;
}

export const KineticCaptions: React.FC<KineticCaptionsProps> = ({
  text,
  wordTimings,
  accentColor = '#F97316',
  theme = 'light-pill',
  wordsPerChunk = 4,
  insetRight = 44,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const resolvedTimings = useMemo(() => {
    if (wordTimings && wordTimings.length > 0) return wordTimings;
    return buildFallbackTimings(text, durationInFrames, fps);
  }, [wordTimings, text, durationInFrames, fps]);

  const chunks = useMemo(() => groupIntoPhraseChunks(resolvedTimings, wordsPerChunk), [resolvedTimings, wordsPerChunk]);

  if (chunks.length === 0) return null;

  // Before speech begins (leading silence), keep clean or gently show first chunk without active highlight
  const firstStart = resolvedTimings[0].startFrame;
  const lastEnd = resolvedTimings[resolvedTimings.length - 1].endFrame;

  if (frame < Math.max(0, firstStart - 3) || frame > lastEnd + 14) {
    return null;
  }

  // Locate active chunk & active word by frame
  let activeChunkIdx = 0;
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const nextStart = i < chunks.length - 1 ? chunks[i + 1].startFrame : Infinity;
    if (frame >= c.startFrame && frame < nextStart) {
      activeChunkIdx = i;
      break;
    }
    if (frame >= c.startFrame) {
      activeChunkIdx = i;
    }
  }

  const activeChunk = chunks[activeChunkIdx];
  let activeWordPos = -1;
  for (let wIdx = 0; wIdx < activeChunk.words.length; wIdx++) {
    const w = activeChunk.words[wIdx];
    const nextW = wIdx < activeChunk.words.length - 1 ? activeChunk.words[wIdx + 1].startFrame : Infinity;
    if (frame >= w.startFrame && frame < Math.max(w.endFrame, nextW)) {
      activeWordPos = wIdx;
      break;
    }
  }
  // During a trailing pause after the chunk's last word, keep the last word softly highlighted
  if (activeWordPos === -1 && frame >= activeChunk.words[activeChunk.words.length - 1].endFrame) {
    activeWordPos = activeChunk.words.length - 1;
  }

  const pop = spring({
    frame: Math.max(0, frame - activeChunk.startFrame),
    fps,
    config: { damping: 16, stiffness: 220 },
  });

  const isBrutal = theme === 'brutal-pill';
  const isLightPill = theme === 'light-pill';
  // Genome caption treatment (preset genomes use 'pill' = classic look)
  const treatment = isBrutal ? 'box' : TOKENS.caption.treatment;
  const hlMode = TOKENS.caption.highlight;
  const bare = treatment === 'outline' || treatment === 'plain' || treatment === 'underline';
  const pillBg = bare
    ? 'transparent'
    : treatment === 'box'
      ? TOKENS.palette.surface
      : isBrutal
        ? '#FFFFFF'
        : isLightPill
          ? 'rgba(255, 255, 255, 0.94)'
          : 'rgba(10, 14, 28, 0.88)';
  const pillBorder = bare
    ? 'none'
    : treatment === 'box'
      ? Math.max(3, TOKENS.shape.stroke) + 'px solid ' + TOKENS.palette.deep
      : isLightPill
        ? '1.5px solid rgba(15, 23, 42, 0.08)'
        : '1.5px solid rgba(255, 255, 255, 0.16)';
  const baseTextColor = bare ? '#FFFFFF' : treatment === 'box' ? TOKENS.palette.surfaceInk : isLightPill ? '#1E293B' : '#F8FAFC';
  const bareShadow = treatment === 'outline' ? '0 0 2px #000, 0 4px 0 rgba(0,0,0,0.85)' : '0 4px 18px rgba(0,0,0,0.85), 0 2px 2px rgba(0,0,0,0.9)';

  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: \`0 \${insetRight}px 136px 44px\`,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: 'auto',
          maxWidth: 920,
          boxSizing: 'border-box',
          padding: '16px 28px',
          borderRadius: treatment === 'box' ? Math.min(18, TOKENS.shape.radius) : 28,
          backgroundColor: pillBg,
          border: pillBorder,
          backdropFilter: bare || treatment === 'box' ? undefined : 'blur(16px)',
          boxShadow: bare ? 'none' : treatment === 'box' ? '8px 8px 0 ' + TOKENS.palette.deep : '0 14px 40px rgba(15, 23, 42, 0.24)',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '6px 10px',
          transform: \`scale(\${0.94 + pop * 0.06})\`,
        }}
      >
        {activeChunk.words.map((wt, idx) => {
          const isActive = idx === activeWordPos;
          const wordPop = isActive
            ? spring({ frame: Math.max(0, frame - wt.startFrame), fps, config: { damping: 11, stiffness: 320, mass: 0.6 } })
            : 0;
          return (
            <span
              key={\`\${activeChunkIdx}-\${idx}\`}
              style={{
                fontFamily: TOKENS.fonts.body,
                fontSize: bare ? 48 : 40,
                fontWeight: isActive ? 900 : 700,
                lineHeight: 1.22,
                padding: '4px 10px',
                borderRadius: 12,
                textShadow: bare && !(isActive && hlMode !== 'color') ? bareShadow : undefined,
                WebkitTextStroke: treatment === 'outline' && !(isActive && hlMode !== 'color') ? '2px #0B0F1A' : undefined,
                backgroundColor: isActive
                  ? treatment === 'underline'
                    ? 'transparent'
                    : hlMode === 'color' && (isLightPill || bare || treatment === 'box')
                      ? 'transparent'
                      : accentColor
                  : 'transparent',
                color: isActive
                  ? treatment === 'underline'
                    ? '#FFFFFF'
                    : hlMode === 'color' && (isLightPill || bare || treatment === 'box')
                      ? accentColor
                      : TOKENS.palette.onAccent
                  : baseTextColor,
                borderBottom: isActive && treatment === 'underline' ? '8px solid ' + accentColor : undefined,
                border: isActive && (isBrutal || hlMode === 'box') ? '3px solid #0A0A0A' : undefined,
                transform: isActive ? \`scale(\${1 + wordPop * 0.1}) translateY(\${-4 * wordPop}px)\` : 'scale(1)',
                display: 'inline-block',
                wordBreak: 'break-word',
                maxWidth: '100%',
              }}
            >
              {wt.word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
`;

    await fs.writeFile(fullPath, code, 'utf-8');
    console.log(`[Writer] 💬 Saved Shared Component: ${captionsRelPath}`);
    return captionsRelPath;
  }

  /**
   * Finalisasi proyek: Root.tsx (beserta Google Fonts), index.ts, tsconfig.json, assets.d.ts, metadata.json
   */
  async finalizeProject(
    blueprint: DirectorBlueprint,
    synopsis: string = '',
    style?: StyleProfile
  ): Promise<{ rootPath: string; indexPath: string; metaPath: string }> {
    const relativeMainImport = './' + blueprint.mainFilePath.replace(/\\/g, '/').replace(/\.tsx?$|\.jsx?$/, '');

    // 1. Root.tsx (memuat Google Fonts modern Plus Jakarta Sans & Space Grotesk)
    const rootPath = path.join(this.baseDir, 'Root.tsx');
    const fontIds = Array.from(new Set(['plus-jakarta-sans', 'space-grotesk', ...this.genomeFonts])).filter(
      (id) => id in FONT_CATALOG
    ) as Array<keyof typeof FONT_CATALOG>;
    const fontImports = fontIds.map((id, i) => `import { loadFont as loadFont${i} } from '@remotion/google-fonts/${FONT_CATALOG[id].module}';`).join('\n');
    const fontLoads = fontIds
      .map((id, i) => `loadFont${i}('normal', { weights: ${JSON.stringify(FONT_CATALOG[id].weights)}, subsets: ['latin'] });`)
      .join('\n');
    const rootCode = `import React from 'react';
import { Composition } from 'remotion';
${fontImports}
import { ${blueprint.mainCompositionName} } from '${relativeMainImport}';

// Load only the weights/subsets we use (loading every variant = 70+ requests and render timeouts)
${fontLoads}

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="${blueprint.mainCompositionName}"
        component={${blueprint.mainCompositionName}}
        durationInFrames={${blueprint.totalDurationInFrames}}
        fps={${blueprint.fps}}
        width={${blueprint.width}}
        height={${blueprint.height}}
      />
    </>
  );
};
`;
    await fs.writeFile(rootPath, rootCode, 'utf-8');

    // 2. index.ts
    const indexPath = path.join(this.baseDir, 'index.ts');
    const indexCode = `import { registerRoot } from 'remotion';
import { RemotionRoot } from './Root';

registerRoot(RemotionRoot);
`;
    await fs.writeFile(indexPath, indexCode, 'utf-8');

    // 3. tsconfig.json (untuk verifikasi kompilasi proyek Remotion terisolasi)
    const tsConfigPath = path.join(this.baseDir, 'tsconfig.json');
    const tsConfigContent = {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'bundler',
        jsx: 'react-jsx',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        resolveJsonModule: true,
        noEmit: true,
      },
      include: ['./**/*.ts', './**/*.tsx'],
    };
    await fs.writeFile(tsConfigPath, JSON.stringify(tsConfigContent, null, 2), 'utf-8');

    // 3b. assets.d.ts (deklarasi tipe untuk import file audio/gambar statis di Remotion)
    const assetsDtsPath = path.join(this.baseDir, 'assets.d.ts');
    const assetsDtsContent = `declare module '*.wav' {
  const src: string;
  export default src;
}
declare module '*.mp3' {
  const src: string;
  export default src;
}
declare module '*.png' {
  const src: string;
  export default src;
}
declare module '*.m4a' {
  const src: string;
  export default src;
}
declare module '*.aac' {
  const src: string;
  export default src;
}
declare module '*.svg' {
  const src: string;
  export default src;
}
`;
    await fs.writeFile(assetsDtsPath, assetsDtsContent, 'utf-8');

    // 4. metadata.json
    const metaPath = path.join(this.baseDir, 'metadata.json');
    await fs.writeFile(
      metaPath,
      JSON.stringify(
        {
          projectName: blueprint.projectName,
          mainCompositionName: blueprint.mainCompositionName,
          mainFilePath: blueprint.mainFilePath,
          totalDurationInFrames: blueprint.totalDurationInFrames,
          fps: blueprint.fps,
          width: blueprint.width,
          height: blueprint.height,
          synopsis,
          style: style
            ? { id: style.id, label: style.label, source: style.source, reasoning: style.reasoning, customStyleNotes: style.customStyleNotes, pacing: style.pacing, musicMood: style.musicMood }
            : undefined,
          scenes: blueprint.scenes,
          createdAt: new Date().toISOString(),
        },
        null,
        2
      ),
      'utf-8'
    );

    console.log(`\n[Writer] ✅ Project Root & Entrypoint ready.`);
    console.log(`[Writer] Root:  ${rootPath}`);
    console.log(`[Writer] Entry: ${indexPath}`);

    return { rootPath, indexPath, metaPath };
  }
}
