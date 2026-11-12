import type { SceneVisualStyleTag } from '../types/story.js';
import {
  describeGenomeForPrompt,
  ensureContrast,
  genomeWorlds,
  inkOn,
  luminance,
  sanitizeGenome,
  type StyleGenome,
} from './genome.js';

/**
 * Global Style Presets ("look & feel" of the whole video).
 *
 * A preset constrains every downstream stage:
 * - Stage 1 (Scriptwriter): which per-scene visual worlds are allowed, narrator voice & tone
 * - Stage 2 (Director): palette, transitions, beat interval (pacing)
 * - Stage 3 (Coder): palette tokens & camera intensity
 * - Writer: BeatFX intensity, SFX pack, music mood, caption accent
 */

export const STYLE_PRESET_IDS = [
  'viral-explainer',
  'clean-editorial',
  'neon-tech',
  'playful-pop',
  'soft-3d-story',
  'chalk-classroom',
  'minimal-mono',
  'cinematic-epic',
  'neo-brutalism',
  'evidence-story',
] as const;

export type StylePresetId = (typeof STYLE_PRESET_IDS)[number];

export type CameraIntensity = 'subtle' | 'medium' | 'punchy';
export type MusicMood = 'upbeat' | 'chill' | 'epic' | 'tech' | 'playful' | 'emotional';
export type SfxPack = 'pop' | 'tech' | 'cinematic' | 'soft';
export type TransitionStyle = 'wipe-right' | 'wipe-left' | 'zoom-focus' | 'fade';
export type GeminiVoice = 'Puck' | 'Charon' | 'Aoede' | 'Fenrir' | 'Kore';
export type VoiceTone = 'enthusiastic' | 'mysterious' | 'authoritative' | 'calm' | 'cinematic';

export interface StylePalette {
  bg: string;
  surface: string;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  textMuted: string;
}

export interface StylePreset {
  id: StylePresetId;
  label: string;
  description: string;
  /** Topics / keywords this preset fits best (used by the LLM picker and the heuristic fallback) */
  bestFor: string[];
  /** Allowed per-scene visual worlds. First entry = default/hook world. */
  sceneStyles: SceneVisualStyleTag[];
  palette: StylePalette;
  captionTheme: 'light-pill' | 'dark-pill' | 'brutal-pill';
  /** Highlight color of the active caption word (must contrast with the caption pill) */
  captionAccent: string;
  transitions: TransitionStyle[];
  pacing: {
    /** Target seconds between visual beats (something visibly changes on every beat) */
    beatIntervalSec: number;
    cameraIntensity: CameraIntensity;
  };
  sfxPack: SfxPack;
  musicMood: MusicMood;
  voice: { geminiVoiceName: GeminiVoice; voiceTone: VoiceTone; voiceSpeed: number };
  /** 'pill' = subtitle pill at the bottom; 'headline' = narration typed word-by-word as the top headline with marker highlights */
  captionMode?: 'pill' | 'headline';
  /** 'standard' = scenes own their title/badge; 'evidence' = persistent brand frame + headline captions, scenes accumulate evidence elements */
  layoutMode?: 'standard' | 'evidence';
}

export const STYLE_PRESETS: Record<StylePresetId, StylePreset> = {
  'viral-explainer': {
    id: 'viral-explainer',
    label: 'Viral Explainer (multi-world)',
    description:
      'High-retention mixed-world explainer: hook in soft-3D/flat vector, mechanism in chalkboard, big picture in glow, CTA in editorial. Fast punches & pops.',
    bestFor: ['fakta', 'facts', 'science', 'sains', 'how it works', 'kenapa', 'why', 'explainer', 'edukasi', 'general'],
    sceneStyles: ['soft-3d', 'flat-vector', 'chalkboard', 'comic-art', 'glow-sketch', 'editorial-ui'],
    palette: {
      bg: '#0B1020', surface: 'rgba(255,255,255,0.92)', primary: '#2563EB', secondary: '#F97316',
      accent: '#FACC15', text: '#0F172A', textMuted: '#475569',
    },
    captionTheme: 'light-pill',
    captionAccent: '#F97316',
    transitions: ['wipe-right', 'wipe-left', 'zoom-focus'],
    pacing: { beatIntervalSec: 1.8, cameraIntensity: 'punchy' },
    sfxPack: 'pop',
    musicMood: 'upbeat',
    voice: { geminiVoiceName: 'Puck', voiceTone: 'enthusiastic', voiceSpeed: 1.08 },
  },
  'clean-editorial': {
    id: 'clean-editorial',
    label: 'Clean Editorial UI',
    description:
      'Crisp light dotted-paper UI cards, checklists, stats and charts. Premium, trustworthy, business-grade. Snappy but not chaotic.',
    bestFor: ['bisnis', 'business', 'produktivitas', 'productivity', 'tips', 'saas', 'marketing', 'finance', 'keuangan', 'karir', 'career', 'tutorial', 'list', 'umkm', 'jualan'],
    sceneStyles: ['editorial-ui', 'flat-vector', 'soft-3d'],
    palette: {
      bg: '#F4F6FA', surface: '#FFFFFF', primary: '#2563EB', secondary: '#0EA5E9',
      accent: '#F97316', text: '#0F172A', textMuted: '#475569',
    },
    captionTheme: 'dark-pill',
    captionAccent: '#F97316',
    transitions: ['wipe-right', 'wipe-left', 'zoom-focus'],
    pacing: { beatIntervalSec: 2.0, cameraIntensity: 'medium' },
    sfxPack: 'soft',
    musicMood: 'chill',
    voice: { geminiVoiceName: 'Kore', voiceTone: 'authoritative', voiceSpeed: 1.05 },
  },
  'neon-tech': {
    id: 'neon-tech',
    label: 'Neon Tech / AI',
    description:
      'Dark canvas, cyan/magenta glow, luminous dotted lines, CGI horizons. For AI, coding, crypto, gadgets, future tech.',
    bestFor: ['ai', 'artificial intelligence', 'coding', 'software', 'programmer', 'crypto', 'blockchain', 'teknologi', 'technology', 'gadget', 'robot', 'future', 'masa depan', 'cyber', 'data', 'agent'],
    sceneStyles: ['glow-sketch', 'cgi-motion', 'editorial-ui', 'dan-koe'],
    palette: {
      bg: '#05060F', surface: 'rgba(20,24,46,0.78)', primary: '#22D3EE', secondary: '#A855F7',
      accent: '#F472B6', text: '#F8FAFC', textMuted: '#94A3B8',
    },
    captionTheme: 'light-pill',
    captionAccent: '#9333EA',
    transitions: ['zoom-focus', 'wipe-right', 'fade'],
    pacing: { beatIntervalSec: 1.8, cameraIntensity: 'punchy' },
    sfxPack: 'tech',
    musicMood: 'tech',
    voice: { geminiVoiceName: 'Fenrir', voiceTone: 'cinematic', voiceSpeed: 1.05 },
  },
  'playful-pop': {
    id: 'playful-pop',
    label: 'Playful Pop / Comic',
    description:
      'Bright flat vectors + comic halftone bursts, bouncy springs, BONK/WHOOSH callouts. For fun facts, food, kids, humor, promos.',
    bestFor: ['lucu', 'funny', 'humor', 'anak', 'kids', 'makanan', 'food', 'kuliner', 'hewan', 'animal', 'promo', 'diskon', 'game', 'viral', 'meme'],
    sceneStyles: ['flat-vector', 'comic-art', 'soft-3d', 'editorial-ui'],
    palette: {
      bg: '#FFF7E6', surface: '#FFFFFF', primary: '#EF4444', secondary: '#22C55E',
      accent: '#FACC15', text: '#111827', textMuted: '#374151',
    },
    captionTheme: 'light-pill',
    captionAccent: '#EF4444',
    transitions: ['wipe-right', 'wipe-left', 'zoom-focus'],
    pacing: { beatIntervalSec: 1.6, cameraIntensity: 'punchy' },
    sfxPack: 'pop',
    musicMood: 'playful',
    voice: { geminiVoiceName: 'Puck', voiceTone: 'enthusiastic', voiceSpeed: 1.12 },
  },
  'soft-3d-story': {
    id: 'soft-3d-story',
    label: 'Soft 3D Story',
    description:
      'Squishy radial-shaded 3D world with expressive rounded characters. "What if" scenarios, body/health facts, everyday physics.',
    bestFor: ['what if', 'bagaimana jika', 'tubuh', 'body', 'kesehatan', 'health', 'sehari-hari', 'daily', 'physics', 'fisika', 'story', 'cerita'],
    sceneStyles: ['soft-3d', 'flat-vector', 'chalkboard', 'editorial-ui'],
    palette: {
      bg: '#E8F1FF', surface: '#FFFFFF', primary: '#3B82F6', secondary: '#F97316',
      accent: '#22C55E', text: '#0F172A', textMuted: '#475569',
    },
    captionTheme: 'light-pill',
    captionAccent: '#F97316',
    transitions: ['wipe-right', 'zoom-focus', 'wipe-left'],
    pacing: { beatIntervalSec: 2.0, cameraIntensity: 'medium' },
    sfxPack: 'pop',
    musicMood: 'upbeat',
    voice: { geminiVoiceName: 'Puck', voiceTone: 'enthusiastic', voiceSpeed: 1.05 },
  },
  'chalk-classroom': {
    id: 'chalk-classroom',
    label: 'Chalk Classroom',
    description:
      'Slate-green board with self-drawing chalk diagrams, formulas and arrows. For math, physics, chemistry, study tips.',
    bestFor: ['matematika', 'math', 'rumus', 'formula', 'kimia', 'chemistry', 'belajar', 'study', 'sekolah', 'school', 'ujian', 'exam', 'teori', 'theory'],
    sceneStyles: ['chalkboard', 'editorial-ui', 'glow-sketch'],
    palette: {
      bg: '#1F3B2F', surface: 'rgba(255,255,255,0.08)', primary: '#FDE68A', secondary: '#93C5FD',
      accent: '#F9A8D4', text: '#F8FAFC', textMuted: '#CBD5E1',
    },
    captionTheme: 'light-pill',
    captionAccent: '#2563EB',
    transitions: ['wipe-right', 'fade', 'zoom-focus'],
    pacing: { beatIntervalSec: 2.0, cameraIntensity: 'subtle' },
    sfxPack: 'soft',
    musicMood: 'chill',
    voice: { geminiVoiceName: 'Charon', voiceTone: 'calm', voiceSpeed: 1.0 },
  },
  'minimal-mono': {
    id: 'minimal-mono',
    label: 'Minimal Mono',
    description:
      'Stark black & white line art, orbital circles, symbolic silhouettes. For self-improvement, mindset, philosophy, motivation.',
    bestFor: ['motivasi', 'motivation', 'mindset', 'filsafat', 'philosophy', 'self improvement', 'pengembangan diri', 'disiplin', 'discipline', 'stoic', 'quotes', 'hidup', 'life', 'sukses', 'success'],
    sceneStyles: ['dan-koe', 'glow-sketch', 'cgi-motion'],
    palette: {
      bg: '#000000', surface: 'rgba(255,255,255,0.06)', primary: '#FFFFFF', secondary: '#A3A3A3',
      accent: '#EAB308', text: '#FFFFFF', textMuted: '#A3A3A3',
    },
    captionTheme: 'light-pill',
    captionAccent: '#CA8A04',
    transitions: ['fade', 'zoom-focus', 'wipe-right'],
    pacing: { beatIntervalSec: 2.2, cameraIntensity: 'subtle' },
    sfxPack: 'cinematic',
    musicMood: 'emotional',
    voice: { geminiVoiceName: 'Charon', voiceTone: 'calm', voiceSpeed: 0.98 },
  },
  'cinematic-epic': {
    id: 'cinematic-epic',
    label: 'Cinematic Epic',
    description:
      'Atmospheric CGI horizons, gold/cyan spotlights, slow push-ins with heavy impacts. For history, space, mystery, documentaries.',
    bestFor: ['sejarah', 'history', 'luar angkasa', 'space', 'planet', 'misteri', 'mystery', 'perang', 'war', 'kerajaan', 'kingdom', 'documentary', 'dokumenter', 'alam semesta', 'universe'],
    sceneStyles: ['cgi-motion', 'glow-sketch', 'dan-koe', 'chalkboard'],
    palette: {
      bg: '#070A14', surface: 'rgba(15,23,42,0.72)', primary: '#F59E0B', secondary: '#38BDF8',
      accent: '#F43F5E', text: '#F8FAFC', textMuted: '#94A3B8',
    },
    captionTheme: 'light-pill',
    captionAccent: '#E11D48',
    transitions: ['fade', 'zoom-focus', 'wipe-right'],
    pacing: { beatIntervalSec: 2.2, cameraIntensity: 'medium' },
    sfxPack: 'cinematic',
    musicMood: 'epic',
    voice: { geminiVoiceName: 'Charon', voiceTone: 'cinematic', voiceSpeed: 1.0 },
  },
  'neo-brutalism': {
    id: 'neo-brutalism',
    label: 'Neo Brutalism',
    description:
      'Cream grid canvas, flat saturated color blocks (yellow, pink, lime, electric blue), thick 5-6px black outlines, hard offset shadows with zero blur, chunky grotesk type, sticker-like cards. Loud, honest, Gen-Z startup / creator vibe.',
    bestFor: ['neo brutalism', 'brutalism', 'brutalist', 'startup', 'produk', 'product', 'brand', 'branding', 'gen z', 'creator', 'konten kreator', 'social media', 'aplikasi', 'app', 'desain', 'design', 'hack', 'fashion', 'skincare', 'launch'],
    sceneStyles: ['neo-brutal', 'comic-art'],
    palette: {
      bg: '#FFF4E0', surface: '#FFFFFF', primary: '#2B59FF', secondary: '#FF5C8A',
      accent: '#FDE047', text: '#0A0A0A', textMuted: '#3F3F46',
    },
    captionTheme: 'brutal-pill',
    captionAccent: '#FDE047',
    transitions: ['wipe-right', 'wipe-left', 'zoom-focus'],
    pacing: { beatIntervalSec: 1.7, cameraIntensity: 'punchy' },
    sfxPack: 'pop',
    musicMood: 'upbeat',
    voice: { geminiVoiceName: 'Puck', voiceTone: 'enthusiastic', voiceSpeed: 1.1 },
  },
  'evidence-story': {
    id: 'evidence-story',
    label: 'Evidence Story (data/bukti)',
    description:
      'Investigative "show the receipts" explainer: narration types itself as a bold slab headline with yellow marker highlights, while evidence piles up word-by-word — screenshot windows, data chips, rubber stamps, red counters, status cards — on a navy halftone canvas that switches to a cream case-file paper. Minimal camera movement; richness comes from word-synced build-up.',
    bestFor: ['bukti', 'data', 'log', 'serangan', 'hack', 'keamanan', 'security', 'server', 'investigasi', 'kasus', 'studi kasus', 'case study', 'statistik', 'laporan', 'report', 'riset', 'hasil', 'eksperimen', 'experiment', 'review', 'pengalaman', 'cerita nyata'],
    sceneStyles: ['halftone-navy', 'paper-file'],
    palette: {
      bg: '#1B2453', surface: '#FFFFFF', primary: '#4F7BFF', secondary: '#E11D48',
      accent: '#FDE047', text: '#F8FAFC', textMuted: '#CBD5E1',
    },
    captionTheme: 'light-pill',
    captionAccent: '#FDE047',
    transitions: ['fade', 'zoom-focus'],
    pacing: { beatIntervalSec: 1.1, cameraIntensity: 'subtle' },
    sfxPack: 'tech',
    musicMood: 'tech',
    voice: { geminiVoiceName: 'Puck', voiceTone: 'enthusiastic', voiceSpeed: 1.08 },
    captionMode: 'headline',
    layoutMode: 'evidence',
  },
};

/** Fully resolved style used by every stage of the pipeline */
export interface StyleProfile extends Omit<StylePreset, 'id'> {
  /** preset id, or 'genome' for a generated look */
  id: StylePresetId | 'genome';
  /** Design tokens for rendering (always present: generated, or derived from the preset) */
  genome: StyleGenome;
  /** 'user' = user explicitly chose a preset id, 'user-freeform' = user text mapped by LLM, 'auto' = LLM/heuristic picked */
  source: 'user' | 'user-freeform' | 'auto' | 'heuristic' | 'brand';
  reasoning: string;
  /** Extra art-direction notes (e.g. user asked "retro 80s synthwave") propagated to all stages */
  customStyleNotes: string;
}

export function isStylePresetId(value: string): value is StylePresetId {
  return (STYLE_PRESET_IDS as readonly string[]).includes(value);
}

/** Tries to match a user-provided style string directly to a preset (id, label, or alias). */
export function matchPresetExact(input: string): StylePresetId | null {
  const norm = input.trim().toLowerCase().replace(/[_\s]+/g, '-');
  if (isStylePresetId(norm)) return norm;
  for (const preset of Object.values(STYLE_PRESETS)) {
    const labelNorm = preset.label.toLowerCase().replace(/[_\s]+/g, '-');
    if (labelNorm === norm || labelNorm.startsWith(norm)) return preset.id;
  }
  return null;
}

/**
 * Deterministic keyword-based fallback picker (used when the LLM style analyst fails or is skipped).
 */
export function pickPresetHeuristically(text: string): { id: StylePresetId; score: number } {
  const lower = ` ${text.toLowerCase()} `;
  let best: { id: StylePresetId; score: number } = { id: 'viral-explainer', score: 0 };
  for (const preset of Object.values(STYLE_PRESETS)) {
    let score = 0;
    for (const kw of preset.bestFor) {
      const re = new RegExp(`[^a-z0-9]${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^a-z0-9]`, 'i');
      if (re.test(lower)) score += kw.includes(' ') ? 2 : 1;
    }
    if (score > best.score) best = { id: preset.id, score };
  }
  return best;
}

export function buildStyleProfile(
  presetId: StylePresetId,
  meta: {
    source: StyleProfile['source'];
    reasoning?: string;
    customStyleNotes?: string;
    beatIntervalSec?: number;
    musicMood?: MusicMood;
    accentOverride?: string;
  }
): StyleProfile {
  const base = STYLE_PRESETS[presetId];
  const beat =
    meta.beatIntervalSec && meta.beatIntervalSec >= 0.9 && meta.beatIntervalSec <= 3
      ? Number(meta.beatIntervalSec.toFixed(2))
      : base.pacing.beatIntervalSec;
  const accentValid = meta.accentOverride && /^#[0-9a-fA-F]{6}$/.test(meta.accentOverride);
  return {
    ...base,
    captionMode: base.captionMode || 'pill',
    layoutMode: base.layoutMode || 'standard',
    palette: { ...base.palette, ...(accentValid ? { accent: meta.accentOverride! } : {}) },
    pacing: { ...base.pacing, beatIntervalSec: beat },
    musicMood: meta.musicMood || base.musicMood,
    genome: presetToGenome(base),
    source: meta.source,
    reasoning: meta.reasoning || '',
    customStyleNotes: meta.customStyleNotes || '',
  };
}

const PRESET_FONTS: Record<StylePresetId, StyleGenome['fonts']['display']> = {
  'viral-explainer': 'space-grotesk',
  'clean-editorial': 'bricolage-grotesque',
  'neon-tech': 'unbounded',
  'playful-pop': 'rubik',
  'soft-3d-story': 'outfit',
  'chalk-classroom': 'permanent-marker',
  'minimal-mono': 'syne',
  'cinematic-epic': 'playfair-display',
  'neo-brutalism': 'archivo-black',
  'evidence-story': 'roboto-slab',
};

/** Tokens for a preset, so the token-driven components render it faithfully */
export function presetToGenome(preset: StylePreset): StyleGenome {
  const p = preset.palette;
  const dark = luminance(p.bg) < 0.35;
  const brutal = preset.id === 'neo-brutalism';
  const evidence = preset.layoutMode === 'evidence';
  const display = PRESET_FONTS[preset.id];
  return sanitizeGenome({
    name: preset.label,
    moodWords: preset.bestFor.slice(0, 3),
    palette: {
      bg: p.bg,
      bgAlt: evidence ? '#EEE7D7' : dark ? '#F4F1EA' : '#14182B',
      surface: p.surface.startsWith('#') ? p.surface : dark ? '#1E2340' : '#FFFFFF',
      primary: p.primary,
      secondary: p.secondary,
      accent: p.accent,
      danger: '#E11D48',
    },
    fonts: { display, body: 'plus-jakarta-sans', mono: 'jetbrains-mono' },
    displayCase: brutal ? 'upper' : 'none',
    backdrop: {
      gradient: 'radial', gradientAngle: 160, pattern: brutal ? 'grid' : evidence ? 'halftone-edge' : 'dots',
      patternScale: brutal ? 72 : 20, patternOpacity: 0.1, texture: evidence ? 'paper' : 'none', vignette: dark ? 0.5 : 0.2,
      decor: brutal ? 'geometric' : 'none', motion: 'drift',
    },
    shape: {
      radius: brutal ? 12 : evidence ? 8 : 22,
      stroke: brutal ? 5 : evidence ? 4 : 0,
      shadow: brutal || evidence ? 'hard' : preset.id === 'neon-tech' ? 'glow' : 'soft',
      cardStyle: preset.id === 'neon-tech' ? 'glass' : evidence ? 'paper' : 'solid',
    },
    motion: {
      energy: preset.pacing.cameraIntensity === 'punchy' ? 'bouncy' : preset.pacing.cameraIntensity === 'subtle' ? 'calm' : 'balanced',
      cameraMode: evidence ? 'drift' : 'punch',
      cameraIntensity: preset.pacing.cameraIntensity,
    },
    caption: {
      mode: preset.captionMode || 'pill',
      treatment: brutal ? 'box' : 'pill',
      highlight: evidence ? 'marker' : 'color',
    },
    sticker: evidence ? 'stamp' : preset.id === 'neon-tech' ? 'glow' : ['minimal-mono', 'cinematic-epic', 'chalk-classroom'].includes(preset.id) ? 'outline' : 'pill',
    layoutMode: preset.layoutMode || 'standard',
    illustrationWorlds: [],
    beatIntervalSec: preset.pacing.beatIntervalSec,
    musicMood: preset.musicMood,
    sfxPack: preset.sfxPack,
    voice: preset.voice,
    rationale: preset.description,
  });
}

/** StyleProfile for a generated genome (keeps every downstream stage working unchanged) */
export function profileFromGenome(
  g: StyleGenome,
  meta: { source: StyleProfile['source']; reasoning?: string; customStyleNotes?: string }
): StyleProfile {
  const p = g.palette;
  const transitions: TransitionStyle[] =
    g.motion.energy === 'calm' ? ['fade', 'zoom-focus'] : g.motion.energy === 'balanced' ? ['wipe-right', 'zoom-focus', 'fade'] : ['wipe-right', 'wipe-left', 'zoom-focus'];
  return {
    id: 'genome',
    label: g.name,
    description: `${g.moodWords.join(', ')} — ${g.rationale}`,
    bestFor: [],
    sceneStyles: genomeWorlds(g),
    palette: { bg: p.bg, surface: p.surface, primary: p.primary, secondary: p.secondary, accent: p.accent, text: inkOn(p.bg), textMuted: inkOn(p.bg) },
    captionTheme: 'light-pill',
    captionAccent: ensureContrast(p.accent, '#FFFFFF', 3),
    transitions,
    pacing: { beatIntervalSec: g.beatIntervalSec, cameraIntensity: g.motion.cameraIntensity },
    sfxPack: g.sfxPack,
    musicMood: g.musicMood,
    voice: g.voice,
    captionMode: g.caption.mode,
    layoutMode: g.layoutMode,
    genome: g,
    source: meta.source,
    reasoning: meta.reasoning || g.rationale,
    customStyleNotes: meta.customStyleNotes || '',
  };
}

/** Compact text block injected into Stage 1/2/3 prompts */
export function describeStyleForPrompt(style: StyleProfile): string {
  if (style.id === 'genome') {
    return [
      describeGenomeForPrompt(style.genome),
      style.customStyleNotes ? `Extra Art Direction: ${style.customStyleNotes}` : '',
      `Allowed Scene Worlds (visualStyleTag): ${style.sceneStyles.join(', ')} — alternate genome-base / genome-alt between scenes for rhythm`,
      `Preferred Transitions: ${style.transitions.join(', ')}`,
      `Pacing: one visual beat every ~${style.pacing.beatIntervalSec}s`,
      `Narrator: ${style.voice.geminiVoiceName} (${style.voice.voiceTone}, speed ${style.voice.voiceSpeed})`,
      `Caption mode: ${style.captionMode === 'headline' ? 'HEADLINE (narration typed as the top headline; no bottom subtitle pill)' : 'PILL (bottom subtitle pill)'}`,
      `Layout mode: ${style.layoutMode === 'evidence' ? 'EVIDENCE (persistent brand frame; scenes accumulate evidence elements word-by-word)' : 'STANDARD'}`,
    ]
      .filter(Boolean)
      .join('\n');
  }
  const p = style.palette;
  return [
    `Global Style Preset: ${style.id} — ${style.label}`,
    `Look & Feel: ${style.description}`,
    style.customStyleNotes ? `Extra Art Direction: ${style.customStyleNotes}` : '',
    `Allowed Scene Worlds (visualStyleTag): ${style.sceneStyles.join(', ')} (hook default: ${style.sceneStyles[0]})`,
    `Palette: bg ${p.bg}, surface ${p.surface}, primary ${p.primary}, secondary ${p.secondary}, accent ${p.accent}, text ${p.text}, muted ${p.textMuted}`,
    `Preferred Transitions: ${style.transitions.join(', ')}`,
    `Pacing: one visual beat every ~${style.pacing.beatIntervalSec}s, camera intensity "${style.pacing.cameraIntensity}"`,
    `Narrator: ${style.voice.geminiVoiceName} (${style.voice.voiceTone}, speed ${style.voice.voiceSpeed})`,
    `Caption mode: ${style.captionMode === 'headline' ? 'HEADLINE (narration is typed word-by-word as the top headline; no bottom subtitle pill)' : 'PILL (bottom subtitle pill)'}`,
    `Layout mode: ${style.layoutMode === 'evidence' ? 'EVIDENCE (persistent brand frame; scenes accumulate evidence elements word-by-word; avoid scene titles/badges)' : 'STANDARD'}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function listPresetsForPrompt(): string {
  return Object.values(STYLE_PRESETS)
    .map((p) => `- ${p.id}: ${p.label}. ${p.description} Best for: ${p.bestFor.slice(0, 8).join(', ')}.`)
    .join('\n');
}
