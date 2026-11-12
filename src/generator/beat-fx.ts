/**
 * Generates `components/common/BeatFX.tsx` inside the Remotion output project.
 *
 * This is the deterministic "editor" layer that guarantees a visible change on every beat
 * (≈ every 2s) regardless of how static the LLM-written scene component is:
 * - BeatCamera:   punch-in jump-cut reframes held between beats + slow push-in + impact shake
 * - BeatStickers: kinetic 1–3 word sticker text slams (numbers / key terms)
 * - BeatFlash:    short light flash on heavy beats
 * - BeatParticles: radial particle bursts on burst / high-emphasis beats
 * - BeatSfx:      sound effects landing exactly on beat frames
 * - MusicBed:     looping background music with fade in/out (optional)
 * - GlobalProgressBar: retention progress bar
 */
export function buildBeatFxCode(opts: { sfxIds: string[]; musicFile?: string }): string {
  const sfxImports = opts.sfxIds
    .map((id) => `import sfx_${id.replace(/-/g, '_')} from '../../assets/sfx/${id}.wav';`)
    .join('\n');
  const sfxMap = opts.sfxIds.map((id) => `  '${id}': sfx_${id.replace(/-/g, '_')},`).join('\n');
  const musicImport = opts.musicFile ? `import musicBedSrc from '../../assets/music/${opts.musicFile}';` : `const musicBedSrc: string | null = null;`;

  return `import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { SceneBeat } from '../../constants/beats';
import { STYLE_FX } from '../../constants/beats';
import { TOKENS, hexA } from '../../constants/genome';
${sfxImports}
${musicImport}

const SFX_SRC: Record<string, string> = {
${sfxMap}
};

const CAMERA_STRENGTH = { subtle: 0.03, medium: 0.05, punchy: 0.075 } as const;
const EMPHASIS_MUL = { low: 0.6, medium: 1, high: 1.45 } as const;
// Framing pattern for consecutive beats: [zoom multiplier, x offset, y offset, rotation]
const FRAMINGS: Array<[number, number, number, number]> = [
  [0, 0, 0, 0],
  [1.0, -14, -10, -0.35],
  [0.45, 12, 6, 0.3],
  [1.35, 0, -16, 0],
  [0.7, -10, 8, 0.25],
  [1.15, 14, -6, -0.3],
];

function activeBeatIndex(beats: SceneBeat[], frame: number): number {
  let idx = -1;
  for (let i = 0; i < beats.length; i++) {
    if (beats[i].localFrame <= frame) idx = i;
  }
  return idx;
}

function framingFor(i: number, beat: SceneBeat | undefined, strength: number) {
  if (i < 0 || !beat) return { zoom: 0, x: 0, y: 0, rot: 0 };
  const [z, x, y, r] = FRAMINGS[i % FRAMINGS.length];
  const mul = EMPHASIS_MUL[beat.emphasis] ?? 1;
  const rotAllowed = STYLE_FX.cameraIntensity === 'punchy' ? 1 : 0;
  return { zoom: z * strength * mul, x: x * mul, y: y * mul, rot: r * rotAllowed };
}

/**
 * Wraps a scene: holds a new framing on every beat (fast spring "punch-cut"), adds a slow push-in,
 * an extra kick on high-emphasis beats and a decaying shake on impact beats.
 */
export const BeatCamera: React.FC<{ beats: SceneBeat[]; durationInFrames: number; children: React.ReactNode }> = ({
  beats,
  durationInFrames,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const strength = CAMERA_STRENGTH[STYLE_FX.cameraIntensity] ?? 0.05;

  const k = activeBeatIndex(beats, frame);
  // 'drift' (evidence layouts): no punch-cut reframes, only slow push-in + impact kick/shake
  const drift = STYLE_FX.cameraMode === 'drift';
  const prev = drift ? framingFor(-1, undefined, strength) : framingFor(k - 1, beats[k - 1], strength);
  const curr = drift ? framingFor(-1, undefined, strength) : framingFor(k, beats[k], strength);
  const t = k >= 0 ? frame - beats[k].localFrame : 0;
  const p = k >= 0 ? spring({ frame: t, fps, config: { damping: 20, stiffness: 320, mass: 0.6 } }) : 0;

  const zoom = prev.zoom + (curr.zoom - prev.zoom) * p;
  const x = prev.x + (curr.x - prev.x) * p;
  const y = prev.y + (curr.y - prev.y) * p;
  const rot = prev.rot + (curr.rot - prev.rot) * p;

  // Extra kick on strong beats (decays in ~10 frames)
  const beat = k >= 0 ? beats[k] : undefined;
  const kick = beat && beat.emphasis === 'high' ? strength * 0.6 * Math.exp(-t / 5) : 0;

  // Impact shake
  const shaking = beat && (beat.action === 'shake' || beat.sfx === 'impact' || beat.action === 'burst');
  const shakeAmp = shaking ? 14 * Math.exp(-t / 4) * (STYLE_FX.cameraIntensity === 'subtle' ? 0.4 : 1) : 0;
  const sx = Math.sin(t * 2.7) * shakeAmp;
  const sy = Math.cos(t * 3.3) * shakeAmp * 0.7;

  const pushIn = interpolate(frame, [0, Math.max(1, durationInFrames)], [0, strength * 0.5], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = 1.03 + pushIn + zoom + kick;

  return (
    <AbsoluteFill
      style={{
        transform: \`translate(\${x + sx}px, \${y + sy}px) rotate(\${rot}deg) scale(\${scale})\`,
        transformOrigin: '50% 42%',
        willChange: 'transform',
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** Short light flash on heavy beats */
export const BeatFlash: React.FC<{ beats: SceneBeat[] }> = ({ beats }) => {
  const frame = useCurrentFrame();
  let opacity = 0;
  for (const b of beats) {
    const heavy = b.emphasis === 'high' || b.action === 'visual-swap' || b.action === 'reveal' || b.action === 'burst';
    if (!heavy || b.localFrame === 0) continue;
    const t = frame - b.localFrame;
    if (t >= 0 && t < 8) {
      opacity = Math.max(opacity, interpolate(t, [0, 1, 8], [0, STYLE_FX.flashOpacity, 0]));
    }
  }
  if (opacity <= 0.001) return null;
  return <AbsoluteFill style={{ backgroundColor: '#FFFFFF', opacity, pointerEvents: 'none', mixBlendMode: 'screen' }} />;
};

/** Radial particle burst on burst / high-emphasis beats */
export const BeatParticles: React.FC<{ beats: SceneBeat[] }> = ({ beats }) => {
  const frame = useCurrentFrame();
  if (!STYLE_FX.particles) return null;
  const active = beats.filter((b) => {
    const t = frame - b.localFrame;
    return (b.action === 'burst' || b.emphasis === 'high' || b.action === 'counter') && t >= 0 && t < 22;
  });
  if (active.length === 0) return null;
  const colors = [STYLE_FX.palette.primary, STYLE_FX.palette.secondary, STYLE_FX.palette.accent];

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {active.map((b) => {
        const t = frame - b.localFrame;
        const prog = interpolate(t, [0, 22], [0, 1], { extrapolateRight: 'clamp' });
        const ease = 1 - Math.pow(1 - prog, 3);
        return Array.from({ length: 18 }).map((_, i) => {
          const angle = (i / 18) * Math.PI * 2 + b.localFrame * 0.37;
          const dist = 120 + ease * (260 + (i % 3) * 70);
          const size = (i % 3 === 0 ? 22 : 13) * (1 - prog * 0.6);
          return (
            <div
              key={\`\${b.localFrame}-\${i}\`}
              style={{
                position: 'absolute',
                left: 540 + Math.cos(angle) * dist - size / 2,
                top: 820 + Math.sin(angle) * dist - size / 2,
                width: size,
                height: size,
                borderRadius: i % 4 === 0 ? 4 : '50%',
                backgroundColor: colors[i % colors.length],
                opacity: 1 - prog,
                transform: \`rotate(\${angle * 57 + t * 8}deg)\`,
              }}
            />
          );
        });
      })}
    </AbsoluteFill>
  );
};

/** Kinetic 1–3 word sticker slams, placed in the band just above the caption pill */
export const BeatStickers: React.FC<{ beats: SceneBeat[]; durationInFrames: number }> = ({ beats, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const withText = beats.map((b, i) => ({ b, i })).filter(({ b }) => b.onScreenText);

  let current: { b: SceneBeat; i: number; end: number } | null = null;
  for (let n = 0; n < withText.length; n++) {
    const { b, i } = withText[n];
    const nextStart = n < withText.length - 1 ? withText[n + 1].b.localFrame : durationInFrames;
    const end = Math.min(b.localFrame + Math.round(fps * 1.3), nextStart - 2, durationInFrames - 4);
    if (frame >= b.localFrame && frame < end) current = { b, i, end };
  }
  if (!current) return null;

  const t = frame - current.b.localFrame;
  const inS = spring({ frame: t, fps, config: { damping: 9, stiffness: 260, mass: 0.7 } });
  const outP = interpolate(frame, [current.end - 6, current.end], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const tilt = current.i % 2 === 0 ? -4 : 3;
  const offsetX = current.i % 2 === 0 ? -60 : 60;
  const v = STYLE_FX.stickerVariant;
  const text = current.b.onScreenText.toUpperCase();

  const base: React.CSSProperties = {
    fontFamily: TOKENS.fonts.display,
    fontWeight: TOKENS.fonts.displayWeight,
    fontSize: text.length > 12 ? 74 : 92,
    lineHeight: 1,
    letterSpacing: '-0.01em',
    padding: '18px 34px',
    whiteSpace: 'nowrap',
    maxWidth: 980,
  };
  const variantStyle: React.CSSProperties =
    v === 'stamp'
      ? {
          color: TOKENS.palette.danger,
          border: '8px double ' + TOKENS.palette.danger,
          borderRadius: 14,
          backgroundColor: 'rgba(255,255,255,0.88)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
        }
      : v === 'tape'
      ? {
          backgroundColor: hexA(TOKENS.palette.accent, 0.92),
          color: TOKENS.palette.onAccent,
          borderRadius: 2,
          clipPath: 'polygon(2% 0, 98% 4%, 100% 50%, 97% 100%, 3% 96%, 0 50%)',
          boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
        }
      : v === 'pill'
      ? {
          backgroundColor: TOKENS.palette.accent,
          color: TOKENS.palette.onAccent,
          borderRadius: 26,
          border: '6px solid #0B0F1A',
          boxShadow: '10px 10px 0 #0B0F1A',
        }
      : v === 'glow'
        ? {
            color: '#FFFFFF',
            textShadow: \`0 0 18px \${STYLE_FX.palette.primary}, 0 0 42px \${STYLE_FX.palette.secondary}\`,
            WebkitTextStroke: \`2px \${STYLE_FX.palette.primary}\`,
          }
        : {
            color: '#FFFFFF',
            textShadow: '0 6px 30px rgba(0,0,0,0.75)',
            borderTop: \`4px solid \${STYLE_FX.palette.accent}\`,
            borderBottom: \`4px solid \${STYLE_FX.palette.accent}\`,
            borderRadius: 0,
          };

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: v === 'stamp' ? 1000 : 1290,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            ...base,
            ...variantStyle,
            transform:
              v === 'stamp'
                ? \`rotate(\${tilt * 2}deg) scale(\${2.2 - 1.2 * inS})\`
                : \`translateX(\${offsetX}px) rotate(\${tilt}deg) scale(\${(0.35 + inS * 0.65) * (0.85 + outP * 0.15)})\`,
            opacity: outP,
          }}
        >
          {text}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Sound effects landing exactly on beat frames */
export const BeatSfx: React.FC<{ beats: SceneBeat[] }> = ({ beats }) => {
  return (
    <>
      {beats.map((b, i) => {
        const src = b.sfx !== 'none' ? SFX_SRC[b.sfx] : undefined;
        if (!src) return null;
        const vol = (b.emphasis === 'high' ? 0.5 : b.emphasis === 'low' ? 0.24 : 0.36) * STYLE_FX.sfxVolume;
        return (
          <Sequence key={\`sfx-\${i}\`} from={Math.max(0, b.localFrame - (b.sfx === 'whoosh' ? 4 : 0))} durationInFrames={60} layout="none">
            <Audio src={src} volume={vol} />
          </Sequence>
        );
      })}
    </>
  );
};

/** Looping background music bed with fade in/out, kept low under the narration */
export const MusicBed: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => {
  const { fps } = useVideoConfig();
  if (!musicBedSrc) return null;
  return (
    <Audio
      src={musicBedSrc}
      loop
      volume={(f) =>
        interpolate(f, [0, fps * 0.8, durationInFrames - fps * 1.5, durationInFrames], [0, STYLE_FX.musicVolume, STYLE_FX.musicVolume, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      }
    />
  );
};

/** Thin retention progress bar across the whole video */
export const GlobalProgressBar: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const progress = Math.min(1, frame / Math.max(1, durationInFrames - 1));
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 10, backgroundColor: 'rgba(0,0,0,0.18)' }} />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: 10,
          width: \`\${progress * 100}%\`,
          background: \`linear-gradient(90deg, \${STYLE_FX.palette.primary}, \${STYLE_FX.palette.accent})\`,
          boxShadow: \`0 0 16px \${STYLE_FX.palette.primary}\`,
        }}
      />
    </AbsoluteFill>
  );
};
`;
}

/** Sticker look per preset */
export function stickerVariantFor(styleId: string, genomeSticker?: string): 'pill' | 'glow' | 'outline' | 'stamp' | 'tape' {
  if (styleId === 'genome' && genomeSticker) return genomeSticker as 'pill' | 'glow' | 'outline' | 'stamp' | 'tape';
  if (styleId === 'evidence-story') return 'stamp';
  if (styleId === 'neon-tech') return 'glow';
  if (styleId === 'minimal-mono' || styleId === 'cinematic-epic' || styleId === 'chalk-classroom') return 'outline';
  return 'pill';
}
