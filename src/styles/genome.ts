import { z } from 'zod';
import type { SceneVisualStyleTag } from '../types/story.js';

// ============================================================================
// Font catalog (verified against @remotion/google-fonts: Latin subset + weights)
// ============================================================================

export interface FontEntry {
  family: string;
  module: string; // @remotion/google-fonts/<module>
  weights: string[]; // weights we load
  heavy: number; // weight to use for display text
}

export const FONT_CATALOG = {
  'archivo-black': { family: 'Archivo Black', module: 'ArchivoBlack', weights: ['400'], heavy: 400 },
  anton: { family: 'Anton', module: 'Anton', weights: ['400'], heavy: 400 },
  'bricolage-grotesque': { family: 'Bricolage Grotesque', module: 'BricolageGrotesque', weights: ['500', '800'], heavy: 800 },
  fraunces: { family: 'Fraunces', module: 'Fraunces', weights: ['600', '900'], heavy: 900 },
  'dm-serif-display': { family: 'DM Serif Display', module: 'DMSerifDisplay', weights: ['400'], heavy: 400 },
  unbounded: { family: 'Unbounded', module: 'Unbounded', weights: ['600', '900'], heavy: 900 },
  'bebas-neue': { family: 'Bebas Neue', module: 'BebasNeue', weights: ['400'], heavy: 400 },
  syne: { family: 'Syne', module: 'Syne', weights: ['600', '800'], heavy: 800 },
  rubik: { family: 'Rubik', module: 'Rubik', weights: ['500', '700', '900'], heavy: 900 },
  montserrat: { family: 'Montserrat', module: 'Montserrat', weights: ['500', '700', '900'], heavy: 900 },
  poppins: { family: 'Poppins', module: 'Poppins', weights: ['500', '700', '900'], heavy: 900 },
  'playfair-display': { family: 'Playfair Display', module: 'PlayfairDisplay', weights: ['700', '900'], heavy: 900 },
  'instrument-serif': { family: 'Instrument Serif', module: 'InstrumentSerif', weights: ['400'], heavy: 400 },
  'roboto-slab': { family: 'Roboto Slab', module: 'RobotoSlab', weights: ['700', '900'], heavy: 900 },
  'space-grotesk': { family: 'Space Grotesk', module: 'SpaceGrotesk', weights: ['500', '700'], heavy: 700 },
  'alfa-slab-one': { family: 'Alfa Slab One', module: 'AlfaSlabOne', weights: ['400'], heavy: 400 },
  'permanent-marker': { family: 'Permanent Marker', module: 'PermanentMarker', weights: ['400'], heavy: 400 },
  oswald: { family: 'Oswald', module: 'Oswald', weights: ['500', '700'], heavy: 700 },
  outfit: { family: 'Outfit', module: 'Outfit', weights: ['500', '700', '900'], heavy: 900 },
  sora: { family: 'Sora', module: 'Sora', weights: ['500', '800'], heavy: 800 },
  lexend: { family: 'Lexend', module: 'Lexend', weights: ['500', '800'], heavy: 800 },
  'plus-jakarta-sans': { family: 'Plus Jakarta Sans', module: 'PlusJakartaSans', weights: ['500', '700', '800'], heavy: 800 },
  inter: { family: 'Inter', module: 'Inter', weights: ['500', '700', '800'], heavy: 800 },
  'dm-sans': { family: 'DM Sans', module: 'DMSans', weights: ['500', '700', '800'], heavy: 800 },
  manrope: { family: 'Manrope', module: 'Manrope', weights: ['500', '700', '800'], heavy: 800 },
  'jetbrains-mono': { family: 'JetBrains Mono', module: 'JetBrainsMono', weights: ['500', '700'], heavy: 700 },
  'space-mono': { family: 'Space Mono', module: 'SpaceMono', weights: ['400', '700'], heavy: 700 },
  'ibm-plex-mono': { family: 'IBM Plex Mono', module: 'IBMPlexMono', weights: ['500', '700'], heavy: 700 },
} satisfies Record<string, FontEntry>;

export type FontId = keyof typeof FONT_CATALOG;

export const DISPLAY_FONTS = [
  'archivo-black', 'anton', 'bricolage-grotesque', 'fraunces', 'dm-serif-display', 'unbounded', 'bebas-neue', 'syne',
  'rubik', 'montserrat', 'poppins', 'playfair-display', 'instrument-serif', 'roboto-slab', 'space-grotesk',
  'alfa-slab-one', 'permanent-marker', 'oswald', 'outfit', 'sora', 'lexend',
] as const;
export const BODY_FONTS = [
  'plus-jakarta-sans', 'inter', 'dm-sans', 'manrope', 'rubik', 'poppins', 'outfit', 'sora', 'lexend', 'space-grotesk', 'montserrat',
] as const;
export const MONO_FONTS = ['jetbrains-mono', 'space-mono', 'ibm-plex-mono'] as const;

// ============================================================================
// Genome schema (OpenAI strict compatible: no optional / default)
// ============================================================================

const Hex = z.string().describe('#RRGGBB');

export const PATTERNS = ['none', 'dots', 'grid', 'lines', 'diagonal', 'waves', 'checker', 'halftone-edge', 'noise'] as const;
export const DECOR = ['none', 'blobs', 'geometric', 'orbits', 'stars', 'brush', 'frame', 'confetti'] as const;
export const CARD_STYLES = ['solid', 'glass', 'outline', 'paper'] as const;
export const SHADOWS = ['none', 'soft', 'hard', 'glow'] as const;
export const CAPTION_TREATMENTS = ['pill', 'box', 'outline', 'plain', 'underline'] as const;
export const STICKERS = ['pill', 'stamp', 'glow', 'outline', 'tape'] as const;

export const StyleGenomeSchema = z.object({
  name: z.string().describe('Evocative 2-3 word name of this look, e.g. "Midnight Ledger", "Sambal Pop"'),
  moodWords: z.array(z.string()).describe('3 mood words'),
  palette: z.object({
    bg: Hex.describe('main scene background'),
    bgAlt: Hex.describe('contrasting background for alternate scenes (e.g. light if bg is dark)'),
    surface: Hex.describe('card/panel fill'),
    primary: Hex.describe('main brand-like color for key shapes'),
    secondary: Hex.describe('supporting color'),
    accent: Hex.describe('highlight / marker color'),
    danger: Hex.describe('alert / counter / stamp color'),
  }),
  fonts: z.object({
    display: z.enum(DISPLAY_FONTS).describe('headline font'),
    body: z.enum(BODY_FONTS).describe('captions & body font'),
    mono: z.enum(MONO_FONTS).describe('labels / data font'),
  }),
  displayCase: z.enum(['none', 'upper']).describe('uppercase headlines or natural case'),
  backdrop: z.object({
    gradient: z.enum(['flat', 'linear', 'radial', 'mesh']),
    gradientAngle: z.number().describe('0-360'),
    pattern: z.enum(PATTERNS),
    patternScale: z.number().describe('pattern cell size in px, 10-90'),
    patternOpacity: z.number().describe('0.03-0.35'),
    texture: z.enum(['none', 'paper', 'grain', 'scanlines']),
    vignette: z.number().describe('0-1'),
    decor: z.enum(DECOR).describe('decorative shape language around the edges'),
    motion: z.enum(['still', 'drift', 'pulse']),
  }),
  shape: z.object({
    radius: z.number().describe('corner radius 0-40'),
    stroke: z.number().describe('outline width 0-8'),
    shadow: z.enum(SHADOWS),
    cardStyle: z.enum(CARD_STYLES),
  }),
  motion: z.object({
    energy: z.enum(['calm', 'balanced', 'snappy', 'bouncy']),
    cameraMode: z.enum(['punch', 'drift']).describe('punch = jump-cut reframes on beats; drift = slow push-in only'),
    cameraIntensity: z.enum(['subtle', 'medium', 'punchy']),
  }),
  caption: z.object({
    mode: z.enum(['pill', 'headline']).describe('pill = subtitle at bottom; headline = narration typed as top headline'),
    treatment: z.enum(CAPTION_TREATMENTS),
    highlight: z.enum(['color', 'marker', 'box']),
  }),
  sticker: z.enum(STICKERS),
  layoutMode: z.enum(['standard', 'evidence']),
  illustrationWorlds: z
    .array(z.enum(['soft-3d', 'flat-vector', 'chalkboard', 'comic-art', 'glow-sketch', 'dan-koe', 'cgi-motion', 'editorial-ui', 'neo-brutal']))
    .describe('0-2 illustrated worlds that may be mixed in when the story needs characters/props; [] for none'),
  beatIntervalSec: z.number().describe('1.0-2.5'),
  musicMood: z.enum(['upbeat', 'chill', 'epic', 'tech', 'playful', 'emotional']),
  sfxPack: z.enum(['pop', 'tech', 'cinematic', 'soft']),
  voice: z.object({
    geminiVoiceName: z.enum(['Puck', 'Charon', 'Aoede', 'Fenrir', 'Kore']),
    voiceTone: z.enum(['enthusiastic', 'mysterious', 'authoritative', 'calm', 'cinematic']),
    voiceSpeed: z.number().describe('0.98-1.15'),
  }),
  rationale: z.string().describe('1-2 sentences: why this look fits the topic and audience'),
});

export type StyleGenome = z.infer<typeof StyleGenomeSchema>;

/** Brand kit: genes the customer locks (anything omitted stays generative) */
export interface BrandKit {
  name?: string;
  palette?: Partial<StyleGenome['palette']>;
  fonts?: Partial<StyleGenome['fonts']>;
  handle?: string;
  avoid?: string[];
}

// ============================================================================
// Color utils + contrast guardrails (WCAG)
// ============================================================================

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  const v = m ? parseInt(m[1], 16) : 0x888888;
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
export function rgbToHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('').toUpperCase();
}
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
function rgbToHsl([r, g, b]: [number, number, number]): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslToRgb([h, s, l]: [number, number, number]): [number, number, number] {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    t = (t + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
export function hueOf(hex: string): number {
  return rgbToHsl(hexToRgb(hex))[0];
}
export function rotateHue(hex: string, deg: number): string {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  return rgbToHex(hslToRgb([h + deg, s, l]));
}
/** Moves lightness until contrast vs `against` reaches `min` (keeps hue & saturation) */
export function ensureContrast(fg: string, against: string, min: number): string {
  if (contrast(fg, against) >= min) return fg;
  const [h, s, l0] = rgbToHsl(hexToRgb(fg));
  const darker = luminance(against) > 0.4;
  for (let i = 1; i <= 20; i++) {
    const l = darker ? Math.max(0, l0 - i * 0.05) : Math.min(1, l0 + i * 0.05);
    const c = rgbToHex(hslToRgb([h, s, l]));
    if (contrast(c, against) >= min) return c;
  }
  return darker ? '#0B0F1A' : '#FFFFFF';
}
/** Best readable ink (near-black or near-white) on a background */
export function inkOn(bg: string): string {
  return contrast('#0B0F1A', bg) >= contrast('#FFFFFF', bg) ? '#0B0F1A' : '#FFFFFF';
}

const clamp = (v: number, lo: number, hi: number, fb: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fb);
const isHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v || '');

/**
 * Deterministic guardrails: valid hexes, legible contrast, clamped numbers, compatible combos.
 * Never trust the LLM on readability.
 */
export function sanitizeGenome(g: StyleGenome): StyleGenome {
  const p = { ...g.palette };
  for (const k of Object.keys(p) as Array<keyof typeof p>) if (!isHex(p[k])) p[k] = '#888888';
  // bg vs bgAlt must clearly differ so alternate scenes read as a "world switch"
  if (contrast(p.bg, p.bgAlt) < 1.6) p.bgAlt = luminance(p.bg) > 0.4 ? '#14182B' : '#F4EFE6';
  // key colors must pop against the main background (large graphics: 3:1)
  p.primary = ensureContrast(p.primary, p.bg, 3);
  p.danger = ensureContrast(p.danger, p.bg, 3);
  p.accent = ensureContrast(p.accent, p.bg, 2.2);
  const fonts = {
    display: (DISPLAY_FONTS as readonly string[]).includes(g.fonts.display) ? g.fonts.display : 'bricolage-grotesque',
    body: (BODY_FONTS as readonly string[]).includes(g.fonts.body) ? g.fonts.body : 'plus-jakarta-sans',
    mono: (MONO_FONTS as readonly string[]).includes(g.fonts.mono) ? g.fonts.mono : 'jetbrains-mono',
  } as StyleGenome['fonts'];
  return {
    ...g,
    palette: p,
    fonts,
    moodWords: (g.moodWords || []).slice(0, 3),
    backdrop: {
      ...g.backdrop,
      gradientAngle: clamp(g.backdrop.gradientAngle, 0, 360, 160),
      patternScale: clamp(g.backdrop.patternScale, 10, 90, 24),
      patternOpacity: clamp(g.backdrop.patternOpacity, 0, 0.35, 0.12),
      vignette: clamp(g.backdrop.vignette, 0, 1, 0.4),
    },
    shape: { ...g.shape, radius: clamp(g.shape.radius, 0, 40, 16), stroke: clamp(g.shape.stroke, 0, 8, 0) },
    // evidence layout only makes sense with the typed headline
    caption: g.layoutMode === 'evidence' ? { ...g.caption, mode: 'headline' } : g.caption,
    motion: g.layoutMode === 'evidence' ? { ...g.motion, cameraMode: 'drift' } : g.motion,
    beatIntervalSec: clamp(g.beatIntervalSec, 1.0, 2.5, 1.8),
    voice: { ...g.voice, voiceSpeed: clamp(g.voice.voiceSpeed, 0.98, 1.15, 1.05) },
    illustrationWorlds: (g.illustrationWorlds || []).slice(0, 2),
  };
}

/** Derived, render-ready tokens (written to constants/genome.ts) */
export function genomeToTokens(g: StyleGenome) {
  const f = (id: FontId) => `'${FONT_CATALOG[id].family}', 'Plus Jakarta Sans', sans-serif`;
  const p = g.palette;
  const darker = luminance(p.bg) <= luminance(p.bgAlt) ? p.bg : p.bgAlt;
  return {
    name: g.name,
    baseDark: luminance(p.bg) < 0.35,
    altDark: luminance(p.bgAlt) < 0.35,
    palette: {
      ...p,
      /** deep ink for borders/labels on light surfaces: the darker world color if dark enough, else near-black */
      deep: luminance(darker) < 0.08 ? darker : '#0B0F1A',
      ink: inkOn(p.bg),
      inkAlt: inkOn(p.bgAlt),
      surfaceInk: inkOn(p.surface),
      onAccent: inkOn(p.accent),
      onPrimary: inkOn(p.primary),
      onDanger: inkOn(p.danger),
      line: inkOn(p.surface) === '#FFFFFF' ? 'rgba(255,255,255,0.22)' : 'rgba(11,15,26,0.85)',
    },
    fonts: {
      display: f(g.fonts.display),
      body: f(g.fonts.body),
      mono: `'${FONT_CATALOG[g.fonts.mono].family}', monospace`,
      displayWeight: FONT_CATALOG[g.fonts.display].heavy,
    },
    displayCase: g.displayCase,
    backdrop: g.backdrop,
    shape: g.shape,
    motion: {
      ...g.motion,
      spring: {
        calm: { damping: 20, stiffness: 120, mass: 1 },
        balanced: { damping: 15, stiffness: 190, mass: 0.8 },
        snappy: { damping: 18, stiffness: 320, mass: 0.6 },
        bouncy: { damping: 9, stiffness: 240, mass: 0.7 },
      }[g.motion.energy],
    },
    caption: g.caption,
    sticker: g.sticker,
    layoutMode: g.layoutMode,
  };
}
export type GenomeTokens = ReturnType<typeof genomeToTokens>;

/** Worlds a scene may use with this genome */
export function genomeWorlds(g: StyleGenome): SceneVisualStyleTag[] {
  return ['genome-base', 'genome-alt', ...g.illustrationWorlds] as SceneVisualStyleTag[];
}

/** Is a world dark (light text on top)? */
export function isDarkWorld(tag: string, g?: StyleGenome | null): boolean {
  if (tag === 'genome-base') return g ? luminance(g.palette.bg) < 0.35 : true;
  if (tag === 'genome-alt') return g ? luminance(g.palette.bgAlt) < 0.35 : false;
  return ['halftone-navy', 'chalkboard', 'glow-sketch', 'dan-koe', 'cgi-motion'].includes(tag);
}

// ============================================================================
// Diversity: fingerprint, similarity, seeded mutation
// ============================================================================

export interface GenomeFingerprint {
  name: string;
  primaryHue: number;
  bgLight: boolean;
  display: string;
  pattern: string;
  decor: string;
  sticker: string;
  caption: string;
  at: string;
}

export function fingerprint(g: StyleGenome): GenomeFingerprint {
  return {
    name: g.name,
    primaryHue: Math.round(hueOf(g.palette.primary)),
    bgLight: luminance(g.palette.bg) > 0.4,
    display: g.fonts.display,
    pattern: g.backdrop.pattern,
    decor: g.backdrop.decor,
    sticker: g.sticker,
    caption: `${g.caption.mode}/${g.caption.treatment}`,
    at: new Date().toISOString(),
  };
}

/** 0..1 — how close a genome is to a previous one */
export function similarity(a: GenomeFingerprint, b: GenomeFingerprint): number {
  const hueDist = Math.min(Math.abs(a.primaryHue - b.primaryHue), 360 - Math.abs(a.primaryHue - b.primaryHue));
  let s = 0;
  s += hueDist < 25 ? 0.3 : hueDist < 50 ? 0.15 : 0;
  s += a.bgLight === b.bgLight ? 0.1 : 0;
  s += a.display === b.display ? 0.2 : 0;
  s += a.pattern === b.pattern ? 0.12 : 0;
  s += a.decor === b.decor ? 0.1 : 0;
  s += a.sticker === b.sticker ? 0.09 : 0;
  s += a.caption === b.caption ? 0.09 : 0;
  return s;
}

export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded mutation that keeps the genome's character but makes it visibly different */
export function mutateGenome(g: StyleGenome, seed: number, locked: BrandKit = {}, avoidHues: number[] = []): StyleGenome {
  const rnd = mulberry32(seed);
  const pick = <T,>(arr: readonly T[], not?: T): T => {
    const pool = arr.filter((x) => x !== not);
    return pool[Math.floor(rnd() * pool.length)];
  };
  // choose the hue shift that lands the primary farthest from recently used hues
  const baseHue = hueOf(g.palette.primary);
  const candidates = Array.from({ length: 10 }, () => (rnd() < 0.5 ? -1 : 1) * (45 + Math.floor(rnd() * 120)));
  const hueGap = (h: number) =>
    avoidHues.length === 0 ? 180 : Math.min(...avoidHues.map((a) => Math.min(Math.abs(a - h), 360 - Math.abs(a - h))));
  const shift = candidates.reduce((best, c) => (hueGap((baseHue + c + 360) % 360) > hueGap((baseHue + best + 360) % 360) ? c : best), candidates[0]);
  const palette = { ...g.palette };
  for (const k of ['primary', 'secondary', 'accent'] as const) if (!locked.palette?.[k]) palette[k] = rotateHue(palette[k], shift);
  return {
    ...g,
    name: `${g.name} ${['II', 'Remix', 'Alt', 'B-side'][Math.floor(rnd() * 4)]}`,
    palette,
    fonts: { ...g.fonts, display: locked.fonts?.display ?? pick(DISPLAY_FONTS, g.fonts.display) },
    backdrop: { ...g.backdrop, pattern: pick(PATTERNS, g.backdrop.pattern), decor: pick(DECOR, g.backdrop.decor) },
    sticker: pick(STICKERS, g.sticker),
    caption: g.layoutMode === 'evidence' ? g.caption : { ...g.caption, treatment: pick(CAPTION_TREATMENTS, g.caption.treatment) },
  };
}

export function applyBrandKit(g: StyleGenome, kit: BrandKit): StyleGenome {
  return {
    ...g,
    name: kit.name ? `${kit.name} · ${g.name}` : g.name,
    palette: { ...g.palette, ...(kit.palette || {}) },
    fonts: { ...g.fonts, ...(kit.fonts || {}) } as StyleGenome['fonts'],
  };
}

export function describeGenomeForPrompt(g: StyleGenome): string {
  const p = g.palette;
  return [
    `Style Genome: "${g.name}" (${g.moodWords.join(', ')})`,
    `Palette: bg ${p.bg}, bgAlt ${p.bgAlt}, surface ${p.surface}, primary ${p.primary}, secondary ${p.secondary}, accent ${p.accent}, danger ${p.danger}`,
    `Fonts: display ${FONT_CATALOG[g.fonts.display].family} (${g.displayCase === 'upper' ? 'UPPERCASE' : 'natural case'}), body ${FONT_CATALOG[g.fonts.body].family}, mono ${FONT_CATALOG[g.fonts.mono].family}`,
    `Backdrop: ${g.backdrop.gradient} gradient, pattern ${g.backdrop.pattern}, texture ${g.backdrop.texture}, decor ${g.backdrop.decor}`,
    `Shape language: radius ${g.shape.radius}px, stroke ${g.shape.stroke}px, shadow ${g.shape.shadow}, cards ${g.shape.cardStyle}`,
    `Motion: ${g.motion.energy}, camera ${g.motion.cameraMode}/${g.motion.cameraIntensity}`,
    `Scene worlds: 'genome-base' (bg) and 'genome-alt' (bgAlt)${g.illustrationWorlds.length ? `; illustrated worlds allowed: ${g.illustrationWorlds.join(', ')}` : ''}`,
    `Rule: every custom color, font, radius and shadow in scene code MUST come from TOKENS (constants/genome) — never hardcode a palette.`,
  ].join('\n');
}
