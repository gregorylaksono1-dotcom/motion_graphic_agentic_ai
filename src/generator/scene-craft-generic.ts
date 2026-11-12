/**
 * Generic, topic-agnostic beat-friendly components appended to SceneCraft.tsx.
 * Every component takes a `startFrame` (LOCAL scene frame) so the coder can land it exactly on a beat.
 */
export const GENERIC_CRAFT_IMPORTS = `import * as Lucide from 'lucide-react';
import { Img } from 'remotion';
import { TOKENS, hexA } from '../../constants/genome';`;

export const GENERIC_CRAFT_CODE = `

// ============================================================================
// Generic beat-friendly components (topic-agnostic)
// ============================================================================

const isHardVariant = (v?: StyleVariant) => v === 'comic-art' || v === 'neo-brutal';
const isDarkVariant = (v?: StyleVariant) =>
  v === 'genome-base' ? TOKENS.baseDark : v === 'genome-alt' ? TOKENS.altDark : v === 'chalkboard' || v === 'glow-sketch' || v === 'dan-koe' || v === 'cgi-motion' || v === 'halftone-navy';

/** Word-by-word slam-in headline. highlight = words (case-insensitive) painted with the accent color. */
export interface KineticWordsProps {
  text: string;
  startFrame?: number;
  staggerFrames?: number;
  fontSize?: number;
  color?: string;
  accentColor?: string;
  highlight?: string[];
  align?: 'center' | 'left';
  variant?: StyleVariant;
}

export const KineticWords: React.FC<KineticWordsProps> = ({
  text,
  startFrame = 0,
  staggerFrames = 4,
  fontSize = 78,
  color,
  accentColor = TOKENS.palette.primary,
  highlight = [],
  align = 'center',
  variant = 'flat-vector',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(/\\s+/).filter(Boolean);
  const baseColor = color || (isDarkVariant(variant) ? '#FFFFFF' : TOKENS.palette.deep);
  const hl = highlight.map((h) => h.toLowerCase());

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: align === 'center' ? 'center' : 'flex-start', gap: '6px 18px', maxWidth: '100%' }}>
      {words.map((w, i) => {
        const s = spring({ frame: Math.max(0, frame - startFrame - i * staggerFrames), fps, config: { damping: 11, stiffness: 240, mass: 0.7 } });
        const isHl = hl.includes(w.toLowerCase().replace(/[^\\p{L}\\p{N}%]/gu, ''));
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              fontSize,
              fontFamily: TOKENS.fonts.display,
              fontWeight: TOKENS.fonts.displayWeight,
              textTransform: TOKENS.displayCase === 'upper' ? 'uppercase' : 'none',
              lineHeight: 1.05,
              color: isHl ? accentColor : baseColor,
              opacity: s,
              transform: \`translateY(\${(1 - s) * 60}px) scale(\${0.6 + s * 0.4})\`,
              textShadow: isDarkVariant(variant) ? '0 6px 24px rgba(0,0,0,0.55)' : 'none',
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

/** Big number that counts up (e.g. Rp 0 -> Rp 12 jt, 0% -> 87%) */
export interface StatCounterProps {
  to: number;
  from?: number;
  startFrame?: number;
  durationFrames?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  label?: string;
  color?: string;
  fontSize?: number;
  variant?: StyleVariant;
  labelPosition?: 'below' | 'right';
}

export const StatCounter: React.FC<StatCounterProps> = ({
  to,
  from = 0,
  startFrame = 0,
  durationFrames = 36,
  prefix = '',
  suffix = '',
  decimals = 0,
  label,
  color = TOKENS.palette.primary,
  fontSize = 150,
  variant = 'flat-vector',
  labelPosition = 'below',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(frame, [startFrame, startFrame + Math.max(1, durationFrames)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const eased = 1 - Math.pow(1 - p, 3);
  const value = from + (to - from) * eased;
  const pop = spring({ frame: Math.max(0, frame - startFrame - durationFrames), fps, config: { damping: 8, stiffness: 260 } });
  const appear = spring({ frame: Math.max(0, frame - startFrame), fps, config: { damping: 14, stiffness: 200 } });
  const formatted = value.toLocaleString('id-ID', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  return (
    <div style={{ textAlign: labelPosition === 'right' ? 'left' : 'center', display: labelPosition === 'right' ? 'flex' : 'block', alignItems: 'baseline', gap: 24, opacity: appear, transform: \`scale(\${(0.7 + appear * 0.3) * (1 + (p >= 1 ? 0.06 * (1 - pop) : 0))})\` }}>
      <div style={{ fontSize, fontWeight: 900, color, lineHeight: 1, fontFamily: TOKENS.fonts.display, letterSpacing: '-0.03em' }}>
        {prefix}{formatted}{suffix}
      </div>
      {label && (
        <div style={{ marginTop: labelPosition === 'right' ? 0 : 14, fontFamily: TOKENS.fonts.body, fontSize: 34, fontWeight: 800, color: isDarkVariant(variant) ? '#E2E8F0' : TOKENS.palette.deep }}>{label}</div>
      )}
    </div>
  );
};

/** Lucide icon that pops in on a beat. name = PascalCase lucide icon, e.g. "Rocket", "Wallet", "Brain". */
export interface IconPopProps {
  name: string;
  startFrame?: number;
  size?: number;
  color?: string;
  bgColor?: string;
  label?: string;
  variant?: StyleVariant;
}

type IconComponent = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export const IconPop: React.FC<IconPopProps> = ({
  name,
  startFrame = 0,
  size = 120,
  color = TOKENS.palette.onPrimary,
  bgColor = TOKENS.palette.primary,
  label,
  variant = 'flat-vector',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const registry = Lucide as unknown as Record<string, IconComponent | undefined>;
  const Icon: IconComponent = registry[name] || registry['Sparkles'] || (() => null);
  const s = spring({ frame: Math.max(0, frame - startFrame), fps, config: { damping: 9, stiffness: 220, mass: 0.8 } });
  const bob = Math.sin((frame - startFrame) / 9) * 6 * s;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, opacity: Math.min(1, s * 1.4), transform: \`translateY(\${bob}px) scale(\${s})\` }}>
      <div
        style={{
          width: size * 1.7,
          height: size * 1.7,
          backgroundColor: bgColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isHardVariant(variant) ? '8px 8px 0 #111827' : \`0 18px 50px \${bgColor}66\`,
          border: isHardVariant(variant) ? '5px solid #111827' : 'none',
          borderRadius: variant === 'neo-brutal' ? 22 : size * 0.5,
        }}
      >
        <Icon size={size} color={color} strokeWidth={2.2} />
      </div>
      {label && <div style={{ fontSize: 32, fontWeight: 800, color: isDarkVariant(variant) ? '#F8FAFC' : '#0F172A', textAlign: 'center', maxWidth: 360 }}>{label}</div>}
    </div>
  );
};

/** Items revealed one by one at the given LOCAL frames (pass beat frames!) */
export interface RevealListProps {
  items: string[];
  revealFrames: number[];
  accentColor?: string;
  variant?: StyleVariant;
}

export const RevealList: React.FC<RevealListProps> = ({ items, revealFrames, accentColor = TOKENS.palette.primary, variant = 'editorial-ui' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dark = isDarkVariant(variant);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, width: '100%', maxWidth: 900, boxSizing: 'border-box' }}>
      {items.map((item, i) => {
        const at = revealFrames[i] ?? revealFrames[revealFrames.length - 1] ?? 0;
        const s = spring({ frame: Math.max(0, frame - at), fps, config: { damping: 13, stiffness: 220 } });
        const active = frame >= at && (i === items.length - 1 || frame < (revealFrames[i + 1] ?? Infinity));
        const tokenLook = variant === 'genome-base' || variant === 'genome-alt';
        if (tokenLook) {
          return (
            <div
              key={i}
              style={{
                ...tokenCard({ dark, active, color: accentColor }),
                display: 'flex',
                alignItems: 'center',
                gap: 22,
                padding: '24px 30px',
                opacity: s,
                transform: \`translateX(\${(1 - s) * -120}px) scale(\${active ? 1.03 : 1})\`,
              }}
            >
              <div style={{ width: 56, height: 56, borderRadius: Math.min(18, TOKENS.shape.radius), backgroundColor: accentColor, color: TOKENS.palette.onPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: TOKENS.fonts.display, fontWeight: TOKENS.fonts.displayWeight, fontSize: 30, flexShrink: 0 }}>
                {i + 1}
              </div>
              <span style={{ fontFamily: TOKENS.fonts.body, fontSize: 38, fontWeight: 800, color: tokenCardInk(dark), overflowWrap: 'break-word' }}>{item}</span>
            </div>
          );
        }
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 22,
              padding: '24px 30px',
              borderRadius: isHardVariant(variant) ? 14 : 26,
              backgroundColor: dark ? 'rgba(255,255,255,0.08)' : active && isHardVariant(variant) ? accentColor : '#FFFFFF',
              border: isHardVariant(variant)
                ? '5px solid #0A0A0A'
                : \`3px solid \${active ? accentColor : dark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.08)'}\`,
              boxShadow: isHardVariant(variant)
                ? (active ? '10px 10px 0 #0A0A0A' : '6px 6px 0 #0A0A0A')
                : active ? \`0 16px 40px \${accentColor}40\` : '0 8px 24px rgba(15,23,42,0.08)',
              opacity: s,
              transform: \`translateX(\${(1 - s) * -120}px) scale(\${active ? 1.03 : 1})\`,
              boxSizing: 'border-box',
            }}
          >
            <div style={{ width: 56, height: 56, borderRadius: isHardVariant(variant) ? 10 : 18, backgroundColor: isHardVariant(variant) ? '#0A0A0A' : accentColor, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 30, flexShrink: 0 }}>
              {i + 1}
            </div>
            <span style={{ fontSize: 38, fontWeight: 800, color: dark ? '#F8FAFC' : '#0F172A', overflowWrap: 'break-word' }}>{item}</span>
          </div>
        );
      })}
    </div>
  );
};

/** Before/after or A-vs-B split that reveals the right side on a beat */
export interface SplitCompareProps {
  leftTitle: string;
  rightTitle: string;
  leftItems?: string[];
  rightItems?: string[];
  startFrame?: number;
  revealFrame?: number;
  leftColor?: string;
  rightColor?: string;
  variant?: StyleVariant;
}

export const SplitCompare: React.FC<SplitCompareProps> = ({
  leftTitle,
  rightTitle,
  leftItems = [],
  rightItems = [],
  startFrame = 0,
  revealFrame = 45,
  leftColor = TOKENS.palette.danger,
  rightColor = '#22C55E',
  variant = 'flat-vector',
}) => {
  const hardLook = isHardVariant(variant);
  const tokenLook = variant === 'genome-base' || variant === 'genome-alt';
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const l = spring({ frame: Math.max(0, frame - startFrame), fps, config: { damping: 14, stiffness: 200 } });
  const r = spring({ frame: Math.max(0, frame - revealFrame), fps, config: { damping: 12, stiffness: 220 } });
  const panel = (title: string, items: string[], color: string, s: number, fromX: number): React.ReactNode => (
    <div
      style={{
        flex: 1,
        ...(tokenLook ? tokenCard({ dark: isDarkVariant(variant), active: true, color }) : {}),
        borderRadius: tokenLook ? TOKENS.shape.radius : hardLook ? 14 : 30,
        padding: '30px 26px',
        backgroundColor: tokenLook ? TOKENS.palette.surface : hardLook ? color : '#FFFFFF',
        border: tokenLook ? '4px solid ' + color : hardLook ? '6px solid #0A0A0A' : \`5px solid \${color}\`,
        boxShadow: tokenLook ? tokenCard({ active: true, color }).boxShadow : hardLook ? '10px 10px 0 #0A0A0A' : \`0 18px 44px \${color}33\`,
        opacity: s,
        transform: \`translateX(\${(1 - s) * fromX}px) rotate(\${(1 - s) * (fromX > 0 ? 6 : -6)}deg)\`,
        boxSizing: 'border-box',
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 40, fontWeight: 900, color: hardLook ? '#0A0A0A' : color, marginBottom: 18, overflowWrap: 'break-word' }}>{title}</div>
      {items.map((it, i) => (
        <div key={i} style={{ fontSize: 30, fontWeight: 700, color: '#1E293B', marginTop: 12, overflowWrap: 'break-word' }}>• {it}</div>
      ))}
    </div>
  );
  return (
    <div style={{ display: 'flex', gap: 24, width: '100%', alignItems: 'stretch', position: 'relative' }}>
      {panel(leftTitle, leftItems, leftColor, l, -200)}
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: \`translate(-50%, -50%) scale(\${r})\`, width: 96, height: 96, borderRadius: '50%', backgroundColor: '#0F172A', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 34, zIndex: 2 }}>VS</div>
      {panel(rightTitle, rightItems, rightColor, r, 200)}
    </div>
  );
};

/** Local particle burst (use inside a positioned container, e.g. behind a hero object) */
export interface ParticleBurstProps {
  startFrame?: number;
  colors?: string[];
  count?: number;
  radius?: number;
}

export const ParticleBurst: React.FC<ParticleBurstProps> = ({ startFrame = 0, colors = ['#FACC15', '#F97316', '#38BDF8'], count = 16, radius = 260 }) => {
  const frame = useCurrentFrame();
  const t = frame - startFrame;
  if (t < 0 || t > 26) return null;
  const p = t / 26;
  const ease = 1 - Math.pow(1 - p, 3);
  return (
    <div style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, pointerEvents: 'none' }}>
      {Array.from({ length: count }).map((_, i) => {
        const a = (i / count) * Math.PI * 2;
        const d = ease * radius * (0.7 + (i % 3) * 0.2);
        const size = (i % 2 ? 14 : 22) * (1 - p * 0.7);
        return (
          <div key={i} style={{ position: 'absolute', left: Math.cos(a) * d - size / 2, top: Math.sin(a) * d - size / 2, width: size, height: size, borderRadius: '50%', backgroundColor: colors[i % colors.length], opacity: 1 - p }} />
        );
      })}
    </div>
  );
};

/** Index of the current beat (-1 before the first) + frames elapsed since it — sync anything to beats */
export const useBeat = (beatFrames: number[]): { index: number; sinceBeat: number } => {
  const frame = useCurrentFrame();
  let index = -1;
  for (let i = 0; i < beatFrames.length; i++) if (beatFrames[i] <= frame) index = i;
  return { index, sinceBeat: index >= 0 ? frame - beatFrames[index] : frame };
};


// ============================================================================
// Evidence kit (data / proof explainers). All components take a LOCAL startFrame.
// ============================================================================

const MONO = TOKENS.fonts.mono;
const SLAB = TOKENS.fonts.display;

export interface TagLabelProps {
  text: string;
  startFrame?: number;
  tone?: 'red' | 'yellow' | 'navy';
  fontSize?: number;
}

export const TagLabel: React.FC<TagLabelProps> = ({ text, startFrame = 0, tone = 'red', fontSize = 24 }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [startFrame, startFrame + 7], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const bg = tone === 'red' ? TOKENS.palette.danger : tone === 'yellow' ? TOKENS.palette.accent : TOKENS.palette.deep;
  const fg = tone === 'yellow' ? '#111827' : '#FFFFFF';
  if (frame < startFrame) return null;
  return (
    <div
      style={{
        display: 'inline-block',
        fontFamily: MONO,
        fontWeight: 700,
        fontSize,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        backgroundColor: bg,
        color: fg,
        padding: '6px 16px',
        borderRadius: 4,
        border: tone === 'yellow' ? '3px solid #111827' : 'none',
        clipPath: 'inset(0 ' + (100 - p) + '% 0 0)',
      }}
    >
      {text}
    </div>
  );
};

export interface StampProps {
  text: string;
  startFrame?: number;
  color?: string;
  rotate?: number;
  fontSize?: number;
}

/** Rubber-stamp slam ("6 NEGARA", "7 MENIT", "TERBUKTI") */
export const Stamp: React.FC<StampProps> = ({ text, startFrame = 0, color = TOKENS.palette.danger, rotate = -7, fontSize = 92 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < startFrame) return null;
  const s = spring({ frame: frame - startFrame, fps, config: { damping: 9, stiffness: 300, mass: 0.7 } });
  const scale = 2.3 - 1.3 * s;
  const jitter = frame - startFrame < 8 ? Math.sin((frame - startFrame) * 3) * (8 - (frame - startFrame)) * 0.6 : 0;
  return (
    <div
      style={{
        display: 'inline-block',
        fontFamily: SLAB,
        fontWeight: 900,
        fontSize,
        lineHeight: 1,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color,
        padding: '10px 26px',
        border: '8px double ' + color,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.88)',
        opacity: Math.min(0.95, s * 1.4),
        transform: 'translateX(' + jitter + 'px) rotate(' + rotate + 'deg) scale(' + scale + ')',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </div>
  );
};

export interface EvidenceWindowProps {
  title: string;
  tag?: string;
  startFrame?: number;
  /** Real screenshot: pass USER_ASSETS['file.png'] */
  src?: string;
  /** Table fallback when no screenshot: rows of cells (use only real/user-provided data) */
  rows?: string[][];
  highlightRow?: number;
  highlightFrame?: number;
  width?: number;
  height?: number;
}

export const EvidenceWindow: React.FC<EvidenceWindowProps> = ({
  title,
  tag,
  startFrame = 0,
  src,
  rows = [],
  highlightRow,
  highlightFrame = 0,
  width = 960,
  height = 520,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < startFrame) return null;
  const s = spring({ frame: frame - startFrame, fps, config: { damping: 14, stiffness: 200 } });
  return (
    <div style={{ width, opacity: s, transform: 'translateY(' + (1 - s) * 80 + 'px) scale(' + (0.92 + 0.08 * s) + ')' }}>
      {tag && (
        <div style={{ marginBottom: 12, marginLeft: 12 }}>
          <TagLabel text={tag} startFrame={startFrame + 4} />
        </div>
      )}
      <div
        style={{
          width,
          height,
          borderRadius: 14,
          overflow: 'hidden',
          backgroundColor: '#F8FAFC',
          border: '3px solid #0B0F1A',
          boxShadow: '14px 14px 0 ' + TOKENS.palette.primary,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ height: 52, backgroundColor: '#111827', display: 'flex', alignItems: 'center', gap: 10, padding: '0 18px', flexShrink: 0 }}>
          {['#EF4444', '#F59E0B', '#22C55E'].map((c) => (
            <span key={c} style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: c }} />
          ))}
          <span style={{ marginLeft: 12, fontFamily: MONO, fontSize: 22, color: '#E2E8F0', letterSpacing: '0.04em' }}>{title}</span>
        </div>
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {src ? (
            <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top left' }} />
          ) : (
            rows.map((row, i) => {
              const rowIn = interpolate(frame, [startFrame + 6 + i * 2, startFrame + 12 + i * 2], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
              const hl = highlightRow === i && frame >= highlightFrame;
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    gap: 16,
                    padding: '10px 18px',
                    fontFamily: MONO,
                    fontSize: 20,
                    color: hl ? '#FFFFFF' : '#334155',
                    backgroundColor: hl ? TOKENS.palette.danger : i % 2 ? '#EEF2F7' : '#F8FAFC',
                    opacity: rowIn,
                  }}
                >
                  {row.map((cell, j) => (
                    <span key={j} style={{ flex: j === 0 ? 1.4 : 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {cell}
                    </span>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export interface DataChipItem {
  title: string;
  subtitle?: string;
  highlight?: boolean;
}

export const DataChip: React.FC<DataChipItem & { startFrame?: number; theme?: 'dark' | 'light' }> = ({
  title,
  subtitle,
  highlight = false,
  startFrame = 0,
  theme = 'dark',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < startFrame) return null;
  const s = spring({ frame: frame - startFrame, fps, config: { damping: 11, stiffness: 260, mass: 0.6 } });
  const border = highlight ? TOKENS.palette.danger : theme === 'dark' ? '#FFFFFF' : TOKENS.palette.deep;
  return (
    <div
      style={{
        padding: '14px 20px',
        border: '4px solid ' + border,
        borderRadius: 6,
        backgroundColor: theme === 'dark' ? hexA(TOKENS.palette.deep, 0.75) : TOKENS.palette.surface,
        boxShadow: highlight ? '0 0 0 4px ' + hexA(TOKENS.palette.danger, 0.25) + ', 8px 8px 0 ' + TOKENS.palette.danger : 'none',
        opacity: s,
        transform: 'scale(' + (0.7 + 0.3 * s) + ')',
        transformOrigin: 'left center',
        boxSizing: 'border-box',
        minWidth: 0,
      }}
    >
      <div style={{ fontFamily: TOKENS.fonts.body, fontWeight: 800, fontSize: 36, color: theme === 'dark' ? '#FFFFFF' : TOKENS.palette.deep, overflowWrap: 'break-word' }}>
        {title}
      </div>
      {subtitle && <div style={{ fontFamily: MONO, fontSize: 24, color: theme === 'dark' ? TOKENS.palette.accent : '#B45309', marginTop: 4 }}>{subtitle}</div>}
    </div>
  );
};

/** Chips revealed one per frame in revealFrames (pass the frames of the words that name them) */
export const ChipGrid: React.FC<{ items: DataChipItem[]; revealFrames: number[]; columns?: number; theme?: 'dark' | 'light' }> = ({
  items,
  revealFrames,
  columns = 2,
  theme = 'dark',
}) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(' + columns + ', minmax(0, 1fr))', gap: 22, width: '100%', maxWidth: 960 }}>
    {items.map((item, i) => (
      <DataChip key={i} {...item} startFrame={revealFrames[i] ?? revealFrames[revealFrames.length - 1] ?? 0} theme={theme} />
    ))}
  </div>
);

export interface InfoCardProps {
  kicker: string;
  value: string;
  caption?: string;
  startFrame?: number;
  /** frame at which the card turns red (alert) */
  alertFrame?: number;
  width?: number;
}

export const InfoCard: React.FC<InfoCardProps> = ({ kicker, value, caption, startFrame = 0, alertFrame, width = 740 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < startFrame) return null;
  const s = spring({ frame: frame - startFrame, fps, config: { damping: 15, stiffness: 190 } });
  const alert = alertFrame !== undefined && frame >= alertFrame;
  const alertPop = alert ? spring({ frame: frame - (alertFrame as number), fps, config: { damping: 8, stiffness: 300 } }) : 0;
  return (
    <div
      style={{
        width,
        padding: '22px 28px',
        backgroundColor: TOKENS.palette.surface,
        border: '4px solid ' + (alert ? TOKENS.palette.danger : TOKENS.palette.deep),
        borderRadius: 8,
        boxShadow: alert ? '10px 10px 0 ' + hexA(TOKENS.palette.danger, 0.35) : '10px 10px 0 ' + hexA(TOKENS.palette.deep, 0.18),
        opacity: s,
        transform: 'translateY(' + (1 - s) * 40 + 'px) scale(' + (1 + alertPop * 0.03 - (alert ? 0.03 : 0)) + ')',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 20, letterSpacing: '0.1em', color: '#64748B', textTransform: 'uppercase' }}>{kicker}</div>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 56, color: '#0B0F1A', marginTop: 8, letterSpacing: '0.02em' }}>{value}</div>
      {caption && <div style={{ fontFamily: TOKENS.fonts.body, fontWeight: 800, fontSize: 32, color: TOKENS.palette.deep, marginTop: 4 }}>{caption}</div>}
    </div>
  );
};

export interface StatusCardProps {
  kicker: string;
  title: string;
  status?: string;
  startFrame?: number;
}

export const StatusCard: React.FC<StatusCardProps> = ({ kicker, title, status = 'ONLINE', startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < startFrame) return null;
  const s = spring({ frame: frame - startFrame, fps, config: { damping: 12, stiffness: 220 } });
  const blink = Math.floor((frame - startFrame) / 12) % 2 === 0;
  return (
    <div
      style={{
        padding: '26px 32px',
        backgroundColor: '#FFFFFF',
        border: '4px solid ' + TOKENS.palette.deep,
        borderRadius: 8,
        boxShadow: '12px 12px 0 ' + TOKENS.palette.danger,
        opacity: s,
        transform: 'scale(' + (0.8 + 0.2 * s) + ') rotate(' + (1 - s) * -3 + 'deg)',
        display: 'inline-block',
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 20, letterSpacing: '0.12em', color: '#64748B', textTransform: 'uppercase' }}>{kicker}</div>
      <div style={{ fontFamily: SLAB, fontWeight: 900, fontSize: 64, color: '#0B0F1A', marginTop: 6 }}>{title}</div>
      <div
        style={{
          marginTop: 14,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 16px',
          backgroundColor: TOKENS.palette.accent,
          border: '3px solid #0B0F1A',
          fontFamily: MONO,
          fontWeight: 700,
          fontSize: 22,
          color: '#0B0F1A',
        }}
      >
        <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#0B0F1A', opacity: blink ? 1 : 0.2 }} />
        {status}
      </div>
    </div>
  );
};

/** Ruled chart paper (horizontal lines + axis labels) drawing itself in; put cards/counters on top of it */
export const RuledChart: React.FC<{ startFrame?: number; labels?: string[]; width?: number; height?: number; theme?: 'dark' | 'light' }> = ({
  startFrame = 0,
  labels = ['300', '200', '100'],
  width = 968,
  height = 460,
  theme = 'light',
}) => {
  const frame = useCurrentFrame();
  const ink = theme === 'light' ? hexA(TOKENS.palette.deep, 0.35) : 'rgba(255,255,255,0.3)';
  const lines = 7;
  return (
    <div style={{ position: 'relative', width, height }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          backgroundColor: theme === 'light' ? TOKENS.palette.deep : '#FFFFFF',
          transformOrigin: 'top',
          transform: 'scaleY(' + interpolate(frame, [startFrame, startFrame + 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) + ')',
        }}
      />
      {Array.from({ length: lines }).map((_, i) => {
        const p = interpolate(frame, [startFrame + i * 2, startFrame + 12 + i * 2], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const y = (i / (lines - 1)) * height;
        const label = labels[Math.floor((i / lines) * labels.length)];
        return (
          <React.Fragment key={i}>
            <div style={{ position: 'absolute', left: 8, right: 0, top: y, height: 2, backgroundColor: ink, transformOrigin: 'left', transform: 'scaleX(' + p + ')' }} />
            {i % 2 === 0 && label && (
              <div style={{ position: 'absolute', left: 14, top: y - 26, fontFamily: MONO, fontSize: 18, color: ink, opacity: p }}>{label}</div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};


// ============================================================================
// Style Genome: parametric backdrop + token-driven badge/headline/cards
// ============================================================================

const NOISE_SVG =
  "url(\\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.55'/></svg>\\")";

function patternLayer(kind: string, color: string, size: number, drift: number): React.CSSProperties | null {
  const pos = drift + 'px ' + drift * 0.5 + 'px';
  switch (kind) {
    case 'dots':
      return { backgroundImage: 'radial-gradient(' + color + ' ' + Math.max(1.5, size * 0.09) + 'px, transparent ' + (Math.max(1.5, size * 0.09) + 0.6) + 'px)', backgroundSize: size + 'px ' + size + 'px', backgroundPosition: pos };
    case 'grid':
      return { backgroundImage: 'linear-gradient(' + color + ' 2px, transparent 2px), linear-gradient(90deg, ' + color + ' 2px, transparent 2px)', backgroundSize: size + 'px ' + size + 'px', backgroundPosition: pos };
    case 'lines':
      return { backgroundImage: 'repeating-linear-gradient(0deg, ' + color + ' 0px, ' + color + ' 2px, transparent 2px, transparent ' + size + 'px)', backgroundPosition: pos };
    case 'diagonal':
      return { backgroundImage: 'repeating-linear-gradient(45deg, ' + color + ' 0px, ' + color + ' 3px, transparent 3px, transparent ' + size + 'px)', backgroundPosition: pos };
    case 'waves':
      return { backgroundImage: 'repeating-radial-gradient(circle at 0% 100%, transparent 0px, transparent ' + size * 0.8 + 'px, ' + color + ' ' + size * 0.8 + 'px, ' + color + ' ' + (size * 0.8 + 3) + 'px)', backgroundSize: size * 4 + 'px ' + size * 4 + 'px' };
    case 'checker':
      return { backgroundImage: 'conic-gradient(' + color + ' 25%, transparent 0 50%, ' + color + ' 0 75%, transparent 0)', backgroundSize: size * 2 + 'px ' + size * 2 + 'px', backgroundPosition: pos };
    case 'halftone-edge': {
      const mask = 'radial-gradient(ellipse 70% 60% at 50% 45%, transparent 35%, black 100%)';
      return { backgroundImage: 'radial-gradient(' + color + ' ' + size * 0.2 + 'px, transparent ' + (size * 0.2 + 0.6) + 'px)', backgroundSize: size + 'px ' + size + 'px', WebkitMaskImage: mask, maskImage: mask };
    }
    case 'noise':
      return { backgroundImage: NOISE_SVG, mixBlendMode: 'overlay' };
    default:
      return null;
  }
}

const Decor: React.FC<{ kind: string; ink: string }> = ({ kind, ink }) => {
  const frame = useCurrentFrame();
  const P = TOKENS.palette;
  const S = TOKENS.shape;
  const stroke = S.stroke > 0 ? S.stroke + 1 : 0;
  const hardShadow = S.shadow === 'hard';
  const bob = Math.sin(frame / 22) * 10;
  const shape = (node: React.ReactNode, key: string) => (
    <g key={key}>
      {hardShadow && <g transform="translate(10 10)" style={{ filter: 'brightness(0)', opacity: 0.85 }}>{node}</g>}
      {node}
    </g>
  );
  let content: React.ReactNode = null;
  if (kind === 'blobs') {
    return (
      <AbsoluteFill style={{ filter: 'blur(60px)', opacity: 0.55 }}>
        <div style={{ position: 'absolute', width: 620, height: 620, borderRadius: '50%', backgroundColor: P.primary, left: -220 + bob, top: -160 }} />
        <div style={{ position: 'absolute', width: 520, height: 520, borderRadius: '50%', backgroundColor: P.secondary, right: -200, top: 760 - bob }} />
        <div style={{ position: 'absolute', width: 460, height: 460, borderRadius: '50%', backgroundColor: P.accent, left: -140, bottom: -120 + bob }} />
      </AbsoluteFill>
    );
  }
  if (kind === 'geometric') {
    content = [
      shape(<circle cx={950} cy={230 + bob} r={95} fill={P.accent} stroke={ink} strokeWidth={stroke} />, 'c'),
      shape(<rect x={-30} y={560} width={200} height={130} rx={S.radius} fill={P.primary} stroke={ink} strokeWidth={stroke} transform={'rotate(-12 70 625)'} />, 'r'),
      shape(<path d="M960 1100 l90 160 h-180 z" fill={P.secondary} stroke={ink} strokeWidth={stroke} transform={'rotate(' + frame * 0.3 + ' 960 1200)'} />, 't'),
    ];
  } else if (kind === 'orbits') {
    content = [0, 1, 2].map((i) => (
      <g key={i}>
        <ellipse cx={900} cy={260} rx={180 + i * 90} ry={(180 + i * 90) * 0.45} fill="none" stroke={ink} strokeOpacity={0.35} strokeWidth={2} transform={'rotate(-18 900 260)'} />
        <circle
          cx={900 + Math.cos(frame / (30 + i * 12) + i) * (180 + i * 90)}
          cy={260 + Math.sin(frame / (30 + i * 12) + i) * (180 + i * 90) * 0.45}
          r={9 - i * 2}
          fill={[P.accent, P.primary, P.secondary][i]}
        />
      </g>
    ));
  } else if (kind === 'stars') {
    content = Array.from({ length: 9 }).map((_, i) => {
      const x = [90, 980, 160, 920, 60, 1010, 240, 880, 120][i];
      const y = [220, 300, 980, 900, 1380, 1250, 1700, 1600, 600][i];
      const s = 0.6 + 0.5 * Math.abs(Math.sin(frame / 18 + i));
      return (
        <path key={i} d="M0 -26 L6 -6 L26 0 L6 6 L0 26 L-6 6 L-26 0 L-6 -6 Z" fill={i % 3 === 0 ? P.accent : ink} opacity={0.8} transform={'translate(' + x + ' ' + y + ') scale(' + s + ')'} />
      );
    });
  } else if (kind === 'brush') {
    content = [
      <path key="a" d={'M-40 260 C 200 ' + (180 + bob) + ', 420 340, 700 230'} fill="none" stroke={P.accent} strokeWidth={46} strokeLinecap="round" opacity={0.85} />,
      <path key="b" d={'M420 1720 C 640 ' + (1640 - bob) + ', 860 1800, 1140 1690'} fill="none" stroke={P.primary} strokeWidth={40} strokeLinecap="round" opacity={0.8} />,
    ];
  } else if (kind === 'frame') {
    content = [
      <rect key="f" x={34} y={34} width={1012} height={1852} fill="none" stroke={ink} strokeOpacity={0.5} strokeWidth={3} rx={Math.min(S.radius, 24)} />,
      ...[[34, 34], [1046, 34], [34, 1886], [1046, 1886]].map(([x, y], i) => <circle key={'k' + i} cx={x} cy={y} r={9} fill={P.accent} />),
    ];
  } else if (kind === 'confetti') {
    content = Array.from({ length: 26 }).map((_, i) => {
      const x = (i * 197) % 1080;
      const y = ((i * 331 + frame * (1.2 + (i % 4) * 0.4)) % 2100) - 100;
      const edge = x < 220 || x > 860 || y < 380 || y > 1500;
      if (!edge) return null;
      return <rect key={i} x={x} y={y} width={14} height={26} rx={4} fill={[P.primary, P.secondary, P.accent][i % 3]} transform={'rotate(' + (frame * 2 + i * 40) + ' ' + (x + 7) + ' ' + (y + 13) + ')'} />;
    });
  }
  if (!content) return null;
  return (
    <svg width="1080" height="1920" viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
      {content}
    </svg>
  );
};

export const GenomeBackdrop: React.FC<{ alt?: boolean }> = ({ alt = false }) => {
  const frame = useCurrentFrame();
  const P = TOKENS.palette;
  const B = TOKENS.backdrop;
  const bg = alt ? P.bgAlt : P.bg;
  const dark = alt ? TOKENS.altDark : TOKENS.baseDark;
  const ink = dark ? '#FFFFFF' : P.deep;
  const drift = B.motion === 'drift' ? frame * 0.3 : 0;
  const pulse = B.motion === 'pulse' ? 1 + Math.sin(frame / 22) * 0.035 : 1;
  const tintA = alt ? P.secondary : P.primary;
  const gradient =
    B.gradient === 'linear'
      ? 'linear-gradient(' + B.gradientAngle + 'deg, ' + bg + ' 0%, ' + bg + ' 45%, ' + hexA(tintA, dark ? 0.35 : 0.22) + ' 100%), ' + bg
      : B.gradient === 'radial'
        ? 'radial-gradient(ellipse at 50% 32%, ' + hexA(dark ? '#FFFFFF' : tintA, dark ? 0.12 : 0.16) + ' 0%, transparent 62%), ' + bg
        : B.gradient === 'mesh'
          ? 'radial-gradient(at 12% 8%, ' + hexA(P.primary, 0.4) + ' 0px, transparent 45%), radial-gradient(at 92% 30%, ' + hexA(P.secondary, 0.35) + ' 0px, transparent 45%), radial-gradient(at 20% 95%, ' + hexA(P.accent, 0.3) + ' 0px, transparent 45%), ' + bg
          : bg;
  const pattern = patternLayer(B.pattern, hexA(dark ? '#FFFFFF' : '#0B0F1A', B.patternOpacity), B.patternScale, drift);
  return (
    <AbsoluteFill style={{ backgroundColor: bg, overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: gradient, transform: 'scale(' + pulse + ')' }} />
      {pattern && <AbsoluteFill style={pattern} />}
      {B.texture === 'grain' && <AbsoluteFill style={{ backgroundImage: NOISE_SVG, opacity: 0.18, mixBlendMode: 'overlay' }} />}
      {B.texture === 'paper' && (
        <AbsoluteFill style={{ backgroundImage: NOISE_SVG + ', repeating-linear-gradient(0deg, rgba(120,100,60,0.05) 0px, rgba(120,100,60,0.05) 1px, transparent 1px, transparent 5px)', opacity: 0.35, mixBlendMode: 'multiply' }} />
      )}
      {B.texture === 'scanlines' && <AbsoluteFill style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 1px, transparent 1px, transparent 4px)' }} />}
      <Decor kind={B.decor} ink={ink} />
      {B.vignette > 0 && <AbsoluteFill style={{ boxShadow: 'inset 0 0 ' + Math.round(80 + 260 * B.vignette) + 'px rgba(0,0,0,' + (dark ? 0.65 : 0.22) * B.vignette + ')' }} />}
    </AbsoluteFill>
  );
};

/** Card look from the genome shape language */
export const tokenCard = (opts: { dark?: boolean; active?: boolean; color?: string } = {}): React.CSSProperties => {
  const S = TOKENS.shape;
  const P = TOKENS.palette;
  const color = opts.color || P.primary;
  const inkLine = opts.dark && S.cardStyle !== 'solid' && S.cardStyle !== 'paper' ? 'rgba(255,255,255,0.35)' : P.deep;
  const bg =
    S.cardStyle === 'glass' ? hexA(opts.dark ? '#FFFFFF' : P.surface, opts.dark ? 0.1 : 0.55) : S.cardStyle === 'outline' ? 'transparent' : P.surface;
  const border =
    S.cardStyle === 'outline' ? Math.max(3, S.stroke) + 'px solid ' + (opts.active ? color : inkLine) : S.stroke > 0 ? S.stroke + 'px solid ' + (opts.active ? color : inkLine) : S.cardStyle === 'glass' ? '1.5px solid rgba(255,255,255,0.28)' : 'none';
  const shadow =
    S.shadow === 'hard'
      ? (opts.active ? 12 : 8) + 'px ' + (opts.active ? 12 : 8) + 'px 0 ' + (opts.active ? color : P.deep)
      : S.shadow === 'glow'
        ? '0 0 ' + (opts.active ? 40 : 22) + 'px ' + hexA(color, 0.55)
        : S.shadow === 'soft'
          ? '0 18px 44px rgba(0,0,0,' + (opts.active ? 0.32 : 0.2) + ')'
          : 'none';
  return {
    backgroundColor: bg,
    border,
    borderRadius: S.radius,
    boxShadow: shadow,
    backdropFilter: S.cardStyle === 'glass' ? 'blur(14px)' : undefined,
    boxSizing: 'border-box',
  };
};

/** Text color on a token card */
export const tokenCardInk = (dark?: boolean): string =>
  TOKENS.shape.cardStyle === 'glass' || TOKENS.shape.cardStyle === 'outline' ? (dark ? '#FFFFFF' : TOKENS.palette.deep) : TOKENS.palette.surfaceInk;

export const GenomeBadge: React.FC<{ sceneNumber: number; totalScenes: number; label: string; dark: boolean }> = ({ sceneNumber, totalScenes, label, dark }) => (
  <div
    style={{
      ...tokenCard({ dark }),
      display: 'inline-flex',
      alignItems: 'center',
      gap: 14,
      padding: '10px 22px',
      fontFamily: TOKENS.fonts.mono,
      fontSize: 22,
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: tokenCardInk(dark),
    }}
  >
    <span style={{ color: TOKENS.palette.danger }}>
      {sceneNumber}/{totalScenes}
    </span>
    <span>{label}</span>
  </div>
);

export const GenomeHeadline: React.FC<{ title: string; subtitle?: string; dark: boolean; align?: 'center' | 'left' }> = ({ title, subtitle, dark, align = 'center' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: TOKENS.motion.spring });
  const ink = dark ? '#FFFFFF' : TOKENS.palette.deep;
  return (
    <div style={{ width: '100%', textAlign: align, marginTop: 24, marginBottom: 14, opacity: s, transform: 'translateY(' + (1 - s) * 30 + 'px)' }}>
      <h1
        style={{
          margin: 0,
          fontFamily: TOKENS.fonts.display,
          fontWeight: TOKENS.fonts.displayWeight,
          fontSize: 72,
          lineHeight: 1.06,
          color: ink,
          textTransform: TOKENS.displayCase === 'upper' ? 'uppercase' : 'none',
          textShadow: TOKENS.shape.shadow === 'hard' ? '5px 5px 0 ' + TOKENS.palette.primary : TOKENS.shape.shadow === 'glow' ? '0 0 24px ' + hexA(TOKENS.palette.primary, 0.6) : 'none',
          overflowWrap: 'break-word',
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <p style={{ margin: '14px 0 0 0', fontFamily: TOKENS.fonts.body, fontWeight: 700, fontSize: 32, color: ink, opacity: 0.85 }}>{subtitle}</p>
      )}
    </div>
  );
};
`;
