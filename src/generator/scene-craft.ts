/**
 * Generates `components/common/SceneCraft.tsx` inside the Remotion output project.
 * Provides reusable, studio-grade motion graphic primitives inspired by multi-style viral explainers:
 * - SceneBackdrop (8 signature visual worlds)
 * - SceneTransitionWipe (crisp wipe/zoom transitions)
 * - ChapterBadge (scene progress pill)
 * - SceneHeadline (high-contrast kinetic headline tailored to each StyleVariant)
 * - StylizedCharacter (expressive non-stick-figure SVG character with poses & reactions)
 * - AppleTreeIllustration & AnimatedApple (layered swaying tree + falling apple with motion lines)
 * - ComicBurst, ChalkAnnotation, OrbitSystem, EditorialShowcaseCard
 */
function buildBaseSceneCraftCode(): string {
  return `import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export type StyleVariant =
  | 'editorial-ui'
  | 'flat-vector'
  | 'soft-3d'
  | 'chalkboard'
  | 'comic-art'
  | 'glow-sketch'
  | 'dan-koe'
  | 'cgi-motion'
  | 'neo-brutal'
  | 'halftone-navy'
  | 'paper-file'
  | 'genome-base'
  | 'genome-alt';

export interface SceneBackdropProps {
  variant?: StyleVariant;
  accentColor?: string;
}

export const SceneBackdrop: React.FC<SceneBackdropProps> = ({
  variant = 'flat-vector',
  accentColor = '#F59E0B',
}) => {
  const frame = useCurrentFrame();
  if (variant === 'genome-base' || variant === 'genome-alt') return <GenomeBackdrop alt={variant === 'genome-alt'} />;
  const cloudDrift1 = ((frame * 0.7) % 1400) - 250;
  const cloudDrift2 = ((frame * 0.45 + 550) % 1400) - 250;
  const pulse = 0.85 + Math.sin(frame / 25) * 0.15;

  if (variant === 'editorial-ui') {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: '#F4F6FA',
          backgroundImage: 'radial-gradient(rgba(15, 23, 42, 0.12) 1.5px, transparent 1.5px)',
          backgroundSize: '28px 28px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -180,
            right: -140,
            width: 680,
            height: 680,
            borderRadius: '50%',
            background: \`radial-gradient(circle, \${accentColor}22 0%, transparent 70%)\`,
            transform: \`scale(\${pulse})\`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -160,
            left: -140,
            width: 620,
            height: 620,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.12) 0%, transparent 70%)',
          }}
        />
      </AbsoluteFill>
    );
  }

  if (variant === 'chalkboard') {
    return (
      <AbsoluteFill
        style={{
          background: 'radial-gradient(circle at 50% 42%, #1D4B39 0%, #113024 68%, #0A1D15 100%)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 20,
            border: '2px dashed rgba(255, 255, 255, 0.14)',
            borderRadius: 24,
            pointerEvents: 'none',
          }}
        />
      </AbsoluteFill>
    );
  }

  if (variant === 'comic-art') {
    return (
      <AbsoluteFill
        style={{
          background: 'linear-gradient(180deg, #56B8F5 0%, #8FD5FF 72%, #E2F5FF 100%)',
          overflow: 'hidden',
        }}
      >
        <svg width="1080" height="1920" viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <pattern id="comicHalftone" width="22" height="22" patternUnits="userSpaceOnUse">
              <circle cx="11" cy="11" r="3.8" fill="#1D6FA8" opacity="0.22" />
            </pattern>
          </defs>
          <rect width="1080" height="1920" fill="url(#comicHalftone)" />
          <g transform={\`translate(\${cloudDrift1}, 240)\`}>
            <path
              d="M40 90 C10 90 0 60 24 44 C24 14 68 2 92 22 C112 -2 164 6 168 42 C196 46 200 90 166 90 Z"
              fill="#FFFFFF"
              stroke="#111827"
              strokeWidth="6"
            />
          </g>
          <g transform={\`translate(\${cloudDrift2}, 380) scale(0.85)\`}>
            <path
              d="M40 90 C10 90 0 60 24 44 C24 14 68 2 92 22 C112 -2 164 6 168 42 C196 46 200 90 166 90 Z"
              fill="#FFFFFF"
              stroke="#111827"
              strokeWidth="6"
            />
          </g>
          <rect x="0" y="1440" width="1080" height="480" fill="#5DBB47" stroke="#111827" strokeWidth="7" />
          <rect x="0" y="1440" width="1080" height="26" fill="#FACC15" stroke="#111827" strokeWidth="5" />
        </svg>
      </AbsoluteFill>
    );
  }

  if (variant === 'neo-brutal') {
    // Neo-brutalism: cream canvas + bold grid, flat saturated shapes, 6px black outlines, hard offset shadows (no blur)
    const ink = '#0A0A0A';
    const bob = Math.sin(frame / 18) * 10;
    const spin = frame * 0.6;
    const drift = Math.sin(frame / 40) * 14;
    const hard = (node: React.ReactNode, dx = 12, dy = 12) => (
      <g>
        <g transform={'translate(' + dx + ' ' + dy + ')'} style={{ filter: 'brightness(0)' }}>{node}</g>
        {node}
      </g>
    );
    return (
      <AbsoluteFill
        style={{
          backgroundColor: '#FFF4E0',
          backgroundImage:
            'linear-gradient(rgba(10,10,10,0.07) 2px, transparent 2px), linear-gradient(90deg, rgba(10,10,10,0.07) 2px, transparent 2px)',
          backgroundSize: '72px 72px',
          overflow: 'hidden',
        }}
      >
        <svg width="1080" height="1920" viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
          {hard(<circle cx={930} cy={250 + bob} r={110} fill="#FDE047" stroke={ink} strokeWidth={6} />)}
          {hard(
            <rect x={-40} y={0} width={240} height={150} rx={18} fill="#FF5C8A" stroke={ink} strokeWidth={6}
              transform={'translate(' + (40 + drift) + ' 520) rotate(-12)'} />
          )}
          {hard(
            <path d="M0 -90 L22 -22 L90 0 L22 22 L0 90 L-22 22 L-90 0 L-22 -22 Z" fill="#2B59FF" stroke={ink} strokeWidth={6}
              transform={'translate(960 1160) rotate(' + spin + ')'} />
          )}
          {hard(
            <rect x={70} y={1330 - bob} width={150} height={150} fill="#A3E635" stroke={ink} strokeWidth={6}
              transform={'rotate(8 145 ' + (1405 - bob) + ')'} />,
            10,
            10
          )}
          <path d="M260 1500 l40 -34 l40 34 l40 -34 l40 34 l40 -34" fill="none" stroke={ink} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={150} cy={300} r={10} fill={ink} />
          <circle cx={190} cy={300} r={10} fill={ink} />
          <circle cx={230} cy={300} r={10} fill={ink} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, border: '10px solid ' + ink, pointerEvents: 'none' }} />
      </AbsoluteFill>
    );
  }

  if (variant === 'halftone-navy') {
    const drift = Math.sin(frame / 70) * 6;
    const edgeMask = 'radial-gradient(ellipse 70% 60% at 50% 45%, transparent 35%, black 100%)';
    return (
      <AbsoluteFill style={{ backgroundColor: '#1B2453', overflow: 'hidden' }}>
        <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 40%, #2A3A86 0%, #1E2A66 45%, #10163A 100%)' }} />
        <AbsoluteFill
          style={{
            backgroundImage: 'radial-gradient(rgba(6,9,30,0.75) 3px, transparent 3.4px)',
            backgroundSize: '15px 15px',
            backgroundPosition: drift + 'px 0px',
            WebkitMaskImage: edgeMask,
            maskImage: edgeMask,
          }}
        />
        <AbsoluteFill
          style={{
            background:
              'radial-gradient(ellipse at 100% 0%, rgba(225,29,72,0.32) 0%, transparent 35%), radial-gradient(ellipse at 0% 100%, rgba(225,29,72,0.26) 0%, transparent 38%)',
          }}
        />
        <AbsoluteFill style={{ boxShadow: 'inset 0 0 240px rgba(0,0,0,0.6)' }} />
      </AbsoluteFill>
    );
  }

  if (variant === 'paper-file') {
    const edgeMask = 'radial-gradient(ellipse 72% 62% at 50% 45%, transparent 45%, black 100%)';
    return (
      <AbsoluteFill style={{ backgroundColor: '#EEE7D7', overflow: 'hidden' }}>
        <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 40%, #F7F2E6 0%, #ECE4D1 65%, #DCD2BB 100%)' }} />
        <AbsoluteFill
          style={{
            backgroundImage: 'radial-gradient(rgba(70,74,100,0.6) 3.2px, transparent 3.6px)',
            backgroundSize: '18px 18px',
            WebkitMaskImage: edgeMask,
            maskImage: edgeMask,
          }}
        />
        <AbsoluteFill
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, rgba(120,100,60,0.04) 0px, rgba(120,100,60,0.04) 1px, transparent 1px, transparent 5px)',
          }}
        />
      </AbsoluteFill>
    );
  }

  if (variant === 'glow-sketch') {
    return (
      <AbsoluteFill
        style={{
          background: 'radial-gradient(circle at 50% 42%, #1D1709 0%, #090A10 58%, #040507 100%)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '22%',
            left: '50%',
            width: 760,
            height: 760,
            transform: \`translate(-50%, -10%) scale(\${pulse})\`,
            borderRadius: '50%',
            background: \`radial-gradient(circle, \${accentColor}2e 0%, transparent 68%)\`,
          }}
        />
        <svg width="1080" height="1920" viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
          {Array.from({ length: 24 }).map((_, i) => {
            const x = ((i * 197 + 73) % 980) + 50;
            const y = ((i * 283 + 110) % 1350) + 80;
            const op = 0.25 + 0.55 * Math.abs(Math.sin(frame / 22 + i));
            return <circle key={i} cx={x} cy={y} r={(i % 3) + 1.5} fill="#FDE68A" opacity={op} />;
          })}
        </svg>
      </AbsoluteFill>
    );
  }

  if (variant === 'dan-koe') {
    return (
      <AbsoluteFill style={{ backgroundColor: '#050505', overflow: 'hidden' }}>
        <svg width="1080" height="1920" viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
          <circle cx="540" cy="820" r="320" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1.5" strokeDasharray="6 10" />
          <circle cx="540" cy="820" r="460" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
          <line x1="80" y1="1430" x2="1000" y2="1430" stroke="rgba(255,255,255,0.32)" strokeWidth="2" />
        </svg>
      </AbsoluteFill>
    );
  }

  if (variant === 'cgi-motion') {
    return (
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, #3D6BB3 0%, #86B3E8 42%, #F5D5B8 53%, #5889CA 53.3%, #1F457D 100%)',
          overflow: 'hidden',
        }}
      >
        <svg width="1080" height="1920" viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
          <polygon points="80,1022 260,860 440,1022" fill="#2A3E63" opacity="0.7" />
          <polygon points="260,860 340,1022 440,1022" fill="#17243D" opacity="0.7" />
          <polygon points="620,1022 830,835 1030,1022" fill="#2A3E63" opacity="0.75" />
          <polygon points="830,835 920,1022 1030,1022" fill="#16233B" opacity="0.75" />
          <line x1="0" y1="1022" x2="1080" y2="1022" stroke="rgba(255,255,255,0.55)" strokeWidth="2" />
        </svg>
      </AbsoluteFill>
    );
  }

  // flat-vector or soft-3d
  const isSoft3d = variant === 'soft-3d';
  return (
    <AbsoluteFill
      style={{
        background: isSoft3d
          ? 'linear-gradient(180deg, #7BC5FA 0%, #BFE4FD 58%, #EBF7FF 100%)'
          : 'linear-gradient(180deg, #4EAEE8 0%, #8ED3F8 58%, #DCF2FD 100%)',
        overflow: 'hidden',
      }}
    >
      <svg width="1080" height="1920" viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <radialGradient id="sunGrad" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#FFF6B3" />
            <stop offset="55%" stopColor="#FCD34D" />
            <stop offset="100%" stopColor="#F59E0B" />
          </radialGradient>
          <linearGradient id="hillBack" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isSoft3d ? '#8CE07A' : '#65B84B'} />
            <stop offset="100%" stopColor={isSoft3d ? '#4FA642' : '#429132'} />
          </linearGradient>
          <linearGradient id="hillFront" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isSoft3d ? '#6BD05B' : '#4FA33B'} />
            <stop offset="100%" stopColor={isSoft3d ? '#2E7D2B' : '#2E7322'} />
          </linearGradient>
        </defs>

        <circle cx="885" cy="245" r="88" fill="url(#sunGrad)" opacity={isSoft3d ? 0.95 : 1} />

        {/* Drifting Clouds */}
        <g transform={\`translate(\${cloudDrift1}, 210)\`} opacity={0.94}>
          <ellipse cx="95" cy="70" rx="75" ry="36" fill="#FFFFFF" />
          <circle cx="70" cy="48" r="38" fill="#FFFFFF" />
          <circle cx="122" cy="44" r="44" fill="#FFFFFF" />
        </g>
        <g transform={\`translate(\${cloudDrift2}, 365) scale(0.82)\`} opacity={0.86}>
          <ellipse cx="95" cy="70" rx="75" ry="36" fill="#FFFFFF" />
          <circle cx="70" cy="48" r="38" fill="#FFFFFF" />
          <circle cx="122" cy="44" r="44" fill="#FFFFFF" />
        </g>

        {/* Layered Rolling Hills */}
        <path d="M-40 1350 Q 270 1230 580 1330 T 1140 1300 L 1140 1920 L -40 1920 Z" fill="url(#hillBack)" />
        <path d="M-40 1440 Q 320 1360 660 1445 T 1140 1415 L 1140 1920 L -40 1920 Z" fill="url(#hillFront)" />
      </svg>
    </AbsoluteFill>
  );
};

export interface SceneTransitionWipeProps {
  transition?: 'wipe-right' | 'wipe-left' | 'zoom-focus' | 'fade';
  durationInFrames?: number;
  children: React.ReactNode;
}

export const SceneTransitionWipe: React.FC<SceneTransitionWipeProps> = ({
  transition = 'wipe-right',
  durationInFrames = 300,
  children,
}) => {
  const frame = useCurrentFrame();
  const enterEnd = 12;
  const exitStart = Math.max(enterEnd + 1, durationInFrames - 8);
  const exitOpacity = interpolate(frame, [exitStart, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (transition === 'wipe-right' || transition === 'wipe-left') {
    const progress = interpolate(frame, [0, enterEnd], [0, 100], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    const clip =
      transition === 'wipe-right'
        ? \`inset(0 \${100 - progress}% 0 0)\`
        : \`inset(0 0 0 \${100 - progress}%)\`;

    return (
      <AbsoluteFill style={{ clipPath: clip, opacity: exitOpacity }}>
        {children}
        {frame < enterEnd && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: transition === 'wipe-right' ? \`\${progress}%\` : \`\${100 - progress}%\`,
              width: 36,
              transform: 'translateX(-50%)',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.65), transparent)',
              pointerEvents: 'none',
            }}
          />
        )}
      </AbsoluteFill>
    );
  }

  if (transition === 'zoom-focus') {
    const enterOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
    const s = interpolate(frame, [0, 14], [0.92, 1], { extrapolateRight: 'clamp' });
    return (
      <AbsoluteFill style={{ opacity: enterOpacity * exitOpacity, transform: \`scale(\${s})\` }}>
        {children}
      </AbsoluteFill>
    );
  }

  const enterOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ opacity: enterOpacity * exitOpacity }}>{children}</AbsoluteFill>;
};

export interface ChapterBadgeProps {
  sceneNumber: number;
  totalScenes?: number;
  label: string;
  variant?: StyleVariant;
}

export const ChapterBadge: React.FC<ChapterBadgeProps> = ({
  sceneNumber,
  totalScenes = 5,
  label,
  variant = 'flat-vector',
}) => {
  if (variant === 'genome-base' || variant === 'genome-alt') {
    return <GenomeBadge sceneNumber={sceneNumber} totalScenes={totalScenes} label={label} dark={variant === 'genome-base' ? TOKENS.baseDark : TOKENS.altDark} />;
  }
  const isHard = variant === 'comic-art' || variant === 'neo-brutal';
  const isLightBg = variant === 'editorial-ui' || variant === 'flat-vector' || variant === 'soft-3d' || variant === 'paper-file' || isHard;
  const bg = isHard
    ? (variant === 'neo-brutal' ? '#FDE047' : '#FACC15')
    : isLightBg
      ? 'rgba(15, 23, 42, 0.82)'
      : 'rgba(255, 255, 255, 0.14)';
  const fg = isHard ? '#111827' : '#FFFFFF';
  const dotActive = variant === 'neo-brutal' ? '#FF5C8A' : variant === 'comic-art' ? '#EF4444' : '#38BDF8';

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 24px',
        borderRadius: variant === 'neo-brutal' ? 12 : 999,
        backgroundColor: bg,
        border: isHard ? '4px solid #111827' : '1px solid rgba(255,255,255,0.18)',
        boxShadow: variant === 'neo-brutal' ? '6px 6px 0 #111827' : isHard ? '4px 4px 0 #111827' : '0 8px 24px rgba(0,0,0,0.18)',
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >
      <span style={{ color: fg, fontWeight: 800, fontSize: 22, letterSpacing: '0.02em' }}>
        {sceneNumber}/{totalScenes}
      </span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {Array.from({ length: totalScenes }).map((_, idx) => (
          <span
            key={idx}
            style={{
              width: idx + 1 === sceneNumber ? 18 : 8,
              height: 8,
              borderRadius: 999,
              backgroundColor: idx + 1 === sceneNumber ? dotActive : isHard ? 'rgba(17,24,39,0.3)' : 'rgba(255,255,255,0.35)',
            }}
          />
        ))}
      </div>
      <span
        style={{
          color: fg,
          fontWeight: 700,
          fontSize: 22,
          overflowWrap: 'break-word',
        }}
      >
        {label}
      </span>
    </div>
  );
};

export interface SceneHeadlineProps {
  title: string;
  subtitle?: string;
  variant?: StyleVariant;
  align?: 'center' | 'left';
}

export const SceneHeadline: React.FC<SceneHeadlineProps> = ({
  title,
  subtitle,
  variant = 'flat-vector',
  align = 'center',
}) => {
  if (variant === 'genome-base' || variant === 'genome-alt') {
    return <GenomeHeadline title={title} subtitle={subtitle} align={align} dark={variant === 'genome-base' ? TOKENS.baseDark : TOKENS.altDark} />;
  }
  const isComic = variant === 'comic-art';
  const isBrutal = variant === 'neo-brutal';
  const isDarkBg = variant === 'chalkboard' || variant === 'glow-sketch' || variant === 'dan-koe' || variant === 'halftone-navy';
  const titleColor = isBrutal ? '#0A0A0A' : isComic ? '#FFFFFF' : isDarkBg ? '#FFFFFF' : '#0F172A';
  const subtitleColor = isComic || isBrutal ? '#111827' : isDarkBg ? '#CBD5E1' : '#334155';

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '100%',
        textAlign: align,
        boxSizing: 'border-box',
        marginTop: 28,
        marginBottom: 16,
      }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: 64,
          fontWeight: 900,
          lineHeight: 1.12,
          color: titleColor,
          overflowWrap: 'break-word',
          WebkitTextStroke: isComic ? '3px #111827' : undefined,
          textShadow: isBrutal
            ? '5px 5px 0 #FF5C8A'
            : isComic
            ? '5px 5px 0 #111827'
            : isDarkBg
              ? '0 4px 20px rgba(0,0,0,0.6)'
              : '0 2px 10px rgba(255,255,255,0.6)',
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <p
          style={{
            margin: '14px auto 0 auto',
            fontSize: 30,
            fontWeight: 700,
            lineHeight: 1.35,
            color: subtitleColor,
            maxWidth: 880,
            overflowWrap: 'break-word',
            backgroundColor: isBrutal ? '#A3E635' : isComic ? '#FACC15' : undefined,
            border: isBrutal ? '4px solid #0A0A0A' : isComic ? '3px solid #111827' : undefined,
            borderRadius: isBrutal ? 10 : isComic ? 14 : undefined,
            boxShadow: isBrutal ? '6px 6px 0 #0A0A0A' : undefined,
            padding: isComic || isBrutal ? '8px 18px' : undefined,
            display: isComic || isBrutal ? 'inline-block' : 'block',
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
};

export interface StylizedCharacterProps {
  pose?: 'standing' | 'sitting' | 'lookingUp' | 'surprised' | 'walking' | 'pointing';
  variant?: 'flat' | 'soft3d' | 'comic' | 'silhouette';
  shirtColor?: string;
  pantsColor?: string;
  hairColor?: string;
  skinColor?: string;
  reaction?: 'none' | 'aha' | 'curious' | 'bonk';
  facing?: 'left' | 'right';
  scale?: number;
}

export const StylizedCharacter: React.FC<StylizedCharacterProps> = ({
  pose = 'standing',
  variant = 'soft3d',
  shirtColor = '#EF4444',
  pantsColor = '#1E3A8A',
  hairColor = '#292524',
  skinColor = '#F7C9A9',
  reaction = 'none',
  facing = 'right',
  scale = 1.25,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const breathe = Math.sin(frame / 14) * 3;
  const blink = frame % 95 >= 90 ? 0.15 : 1;
  const walkSwing = pose === 'walking' ? Math.sin(frame / 6) * 18 : 0;
  const reactPop = spring({ frame: frame % 45, fps, config: { damping: 12, stiffness: 180 } });

  const isSilhouette = variant === 'silhouette';
  const strokeCol = variant === 'comic' ? '#111827' : isSilhouette ? '#FFFFFF' : 'rgba(15,23,42,0.18)';
  const strokeW = variant === 'comic' ? 5 : isSilhouette ? 3 : 2;
  const fillSkin = isSilhouette ? '#050505' : skinColor;
  const fillShirt = isSilhouette ? '#050505' : shirtColor;
  const fillPants = isSilhouette ? '#050505' : pantsColor;
  const fillHair = isSilhouette ? '#FFFFFF' : hairColor;

  const isSitting = pose === 'sitting';
  const headTilt = pose === 'lookingUp' ? -16 : pose === 'surprised' ? -8 : 0;
  const flipX = facing === 'left' ? -1 : 1;

  return (
    <svg
      width={260 * scale}
      height={340 * scale}
      viewBox="0 0 260 340"
      style={{ overflow: 'visible' }}
    >
      <defs>
        <radialGradient id="charShade" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.18)" />
        </radialGradient>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="130" cy="316" rx={isSitting ? 68 : 52} ry="12" fill="rgba(0,0,0,0.22)" />

      <g transform={\`translate(130, 0) scale(\${flipX}, 1) translate(-130, 0)\`}>
        {/* Reaction Bubbles */}
        {reaction === 'aha' && (
          <g transform={\`translate(130, \${34 - reactPop * 8}) scale(\${0.85 + reactPop * 0.2})\`}>
            <circle cx="0" cy="0" r="24" fill="#FDE047" stroke="#111827" strokeWidth="3" />
            <path d="M-8 10 L8 10 M-6 18 L6 18" stroke="#111827" strokeWidth="4" strokeLinecap="round" />
            <line x1="0" y1="-36" x2="0" y2="-48" stroke="#FACC15" strokeWidth="4" strokeLinecap="round" />
            <line x1="-28" y1="-26" x2="-38" y2="-34" stroke="#FACC15" strokeWidth="4" strokeLinecap="round" />
            <line x1="28" y1="-26" x2="38" y2="-34" stroke="#FACC15" strokeWidth="4" strokeLinecap="round" />
          </g>
        )}
        {reaction === 'curious' && (
          <g transform={\`translate(168, \${42 - Math.sin(frame / 10) * 5})\`}>
            <circle cx="0" cy="0" r="22" fill="#FFFFFF" stroke="#111827" strokeWidth="3" />
            <text x="0" y="9" textAnchor="middle" fontSize="28" fontWeight="900" fill="#2563EB">?</text>
          </g>
        )}
        {reaction === 'bonk' && (
          <g transform={\`translate(130, 42) rotate(\${frame * 5})\`}>
            <circle cx="-26" cy="0" r="7" fill="#FACC15" stroke="#111827" strokeWidth="2" />
            <circle cx="26" cy="0" r="7" fill="#FACC15" stroke="#111827" strokeWidth="2" />
            <circle cx="0" cy="-22" r="6" fill="#F97316" stroke="#111827" strokeWidth="2" />
          </g>
        )}

        {/* Legs */}
        {isSitting ? (
          <g transform="translate(0, 22)">
            <path
              d="M112 225 L168 232 L182 282"
              fill="none"
              stroke={fillPants}
              strokeWidth="26"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M126 225 L182 232 L196 282"
              fill="none"
              stroke={fillPants}
              strokeWidth="24"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <ellipse cx="188" cy="286" rx="18" ry="10" fill="#1F2937" />
            <ellipse cx="204" cy="286" rx="18" ry="10" fill="#111827" />
          </g>
        ) : (
          <g>
            <path
              d={\`M114 218 L\${108 - walkSwing} 302\`}
              stroke={fillPants}
              strokeWidth="24"
              strokeLinecap="round"
            />
            <path
              d={\`M146 218 L\${154 + walkSwing} 302\`}
              stroke={fillPants}
              strokeWidth="24"
              strokeLinecap="round"
            />
            <ellipse cx={112 - walkSwing} cy="308" rx="18" ry="10" fill="#1F2937" />
            <ellipse cx={160 + walkSwing} cy="308" rx="18" ry="10" fill="#111827" />
          </g>
        )}

        {/* Torso */}
        <g transform={\`translate(0, \${(isSitting ? 32 : 0) + breathe})\`}>
          <rect
            x="92"
            y="136"
            width="76"
            height="92"
            rx="34"
            fill={fillShirt}
            stroke={strokeCol}
            strokeWidth={strokeW}
          />
          {variant === 'soft3d' && (
            <rect x="92" y="136" width="76" height="92" rx="34" fill="url(#charShade)" />
          )}

          {/* Arms */}
          {pose === 'pointing' || pose === 'surprised' ? (
            <>
              <path d="M96 156 Q 62 170 68 202" fill="none" stroke={fillShirt} strokeWidth="20" strokeLinecap="round" />
              <circle cx="68" cy="204" r="11" fill={fillSkin} stroke={strokeCol} strokeWidth="2" />
              <path
                d={pose === 'pointing' ? 'M162 154 Q 205 130 222 102' : 'M162 154 Q 198 122 190 88'}
                fill="none"
                stroke={fillShirt}
                strokeWidth="20"
                strokeLinecap="round"
              />
              <circle
                cx={pose === 'pointing' ? 224 : 190}
                cy={pose === 'pointing' ? 100 : 86}
                r="11"
                fill={fillSkin}
                stroke={strokeCol}
                strokeWidth="2"
              />
            </>
          ) : (
            <>
              <path d={\`M96 156 Q 74 185 \${82 + walkSwing * 0.4} 214\`} fill="none" stroke={fillShirt} strokeWidth="20" strokeLinecap="round" />
              <circle cx={82 + walkSwing * 0.4} cy="216" r="10" fill={fillSkin} stroke={strokeCol} strokeWidth="2" />
              <path d={\`M164 156 Q 186 185 \${178 - walkSwing * 0.4} 214\`} fill="none" stroke={fillShirt} strokeWidth="20" strokeLinecap="round" />
              <circle cx={178 - walkSwing * 0.4} cy="216" r="10" fill={fillSkin} stroke={strokeCol} strokeWidth="2" />
            </>
          )}

          {/* Head */}
          <g transform={\`translate(130, 102) rotate(\${headTilt}) translate(-130, -102)\`}>
            <circle cx="130" cy="96" r="42" fill={fillSkin} stroke={strokeCol} strokeWidth={strokeW} />
            {variant === 'soft3d' && <circle cx="130" cy="96" r="42" fill="url(#charShade)" />}
            {/* Hair */}
            <path
              d="M88 92 C88 56 118 46 136 48 C164 50 174 70 172 90 C158 76 142 74 126 76 C108 78 96 84 88 92 Z"
              fill={fillHair}
            />
            {/* Eyes */}
            <ellipse cx="122" cy="94" rx="5" ry={6.5 * blink} fill={isSilhouette ? '#FFFFFF' : '#111827'} />
            <ellipse cx="148" cy="94" rx="5" ry={6.5 * blink} fill={isSilhouette ? '#FFFFFF' : '#111827'} />
            {!isSilhouette && (
              <>
                <circle cx="123.5" cy="92" r="1.8" fill="#FFFFFF" />
                <circle cx="149.5" cy="92" r="1.8" fill="#FFFFFF" />
              </>
            )}
            {/* Mouth */}
            {pose === 'surprised' ? (
              <ellipse cx="136" cy="116" rx="7" ry="9" fill="#991B1B" />
            ) : (
              <path
                d="M124 114 Q 136 123 148 114"
                fill="none"
                stroke={isSilhouette ? '#FFFFFF' : '#7C2D12'}
                strokeWidth="3.5"
                strokeLinecap="round"
              />
            )}
          </g>
        </g>
      </g>
    </svg>
  );
};

export interface AnimatedAppleProps {
  size?: number;
  variant?: 'flat' | 'soft3d' | 'comic' | 'chalk';
  showMotionLines?: boolean;
}

export const AnimatedApple: React.FC<AnimatedAppleProps> = ({
  size = 86,
  variant = 'soft3d',
  showMotionLines = false,
}) => {
  const isChalk = variant === 'chalk';
  const isComic = variant === 'comic';

  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 100 125" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id="appleBodyGrad" cx="35%" cy="32%" r="68%">
          <stop offset="0%" stopColor="#FF7A7A" />
          <stop offset="55%" stopColor="#EF4444" />
          <stop offset="100%" stopColor="#991B1B" />
        </radialGradient>
      </defs>

      {showMotionLines && (
        <g opacity="0.8">
          <line x1="25" y1="-28" x2="25" y2="8" stroke={isChalk ? '#FFFFFF' : '#FFFFFF'} strokeWidth="3.5" strokeLinecap="round" strokeDasharray="8 6" />
          <line x1="50" y1="-42" x2="50" y2="0" stroke={isChalk ? '#FDE047' : '#FACC15'} strokeWidth="4" strokeLinecap="round" />
          <line x1="75" y1="-26" x2="75" y2="10" stroke={isChalk ? '#FFFFFF' : '#FFFFFF'} strokeWidth="3.5" strokeLinecap="round" strokeDasharray="8 6" />
        </g>
      )}

      {/* Stem & Leaf */}
      <path
        d="M50 32 Q 52 14 60 8"
        fill="none"
        stroke={isChalk ? '#FDE68A' : '#78350F'}
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      <path
        d="M54 20 Q 74 8 80 22 Q 66 32 54 20 Z"
        fill={isChalk ? 'none' : '#4ADE80'}
        stroke={isComic ? '#111827' : isChalk ? '#86EFAC' : '#166534'}
        strokeWidth={isComic ? 3.5 : 2.5}
      />

      {/* Apple Body */}
      <path
        d="M50 34 C 34 26 14 36 14 60 C 14 86 30 106 44 106 C 48 106 50 103 50 103 C 50 103 52 106 56 106 C 70 106 86 86 86 60 C 86 36 66 26 50 34 Z"
        fill={isChalk ? 'none' : variant === 'soft3d' ? 'url(#appleBodyGrad)' : '#EF4444'}
        stroke={isComic ? '#111827' : isChalk ? '#FCA5A5' : '#991B1B'}
        strokeWidth={isComic ? 5 : isChalk ? 3.5 : 2}
        strokeDasharray={isChalk ? '6 4' : undefined}
      />

      {/* Gloss Highlight */}
      {!isChalk && (
        <ellipse cx="33" cy="52" rx="7" ry="14" transform="rotate(-18 33 52)" fill="rgba(255,255,255,0.45)" />
      )}
    </svg>
  );
};

export interface AppleTreeIllustrationProps {
  width?: number;
  variant?: 'flat' | 'soft3d' | 'comic' | 'chalk';
  /** 0 = hanging on branch, 0..1 = detaching and falling downward */
  appleFallProgress?: number;
  fallDistancePx?: number;
}

export const AppleTreeIllustration: React.FC<AppleTreeIllustrationProps> = ({
  width = 640,
  variant = 'soft3d',
  appleFallProgress = 0,
  fallDistancePx = 310,
}) => {
  const frame = useCurrentFrame();
  const sway = Math.sin(frame / 26) * 2.2;
  const isChalk = variant === 'chalk';
  const isComic = variant === 'comic';
  const strokeCol = isComic ? '#111827' : isChalk ? '#A7F3D0' : '#14532D';
  const strokeW = isComic ? 5 : isChalk ? 3 : 0;

  const clampedFall = Math.max(0, Math.min(1, appleFallProgress));
  // Quadratic gravity easing (g*t^2 feel!)
  const dropY = clampedFall * clampedFall * fallDistancePx;
  const wobble = clampedFall === 0 ? Math.sin(frame / 5) * 3 : Math.sin(clampedFall * 14) * 6;

  return (
    <svg width={width} height={width * 1.1} viewBox="0 0 500 550" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id="canopyLight" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#86EFAC" />
          <stop offset="55%" stopColor="#22C55E" />
          <stop offset="100%" stopColor="#15803D" />
        </radialGradient>
        <linearGradient id="trunkGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#92400E" />
          <stop offset="50%" stopColor="#78350F" />
          <stop offset="100%" stopColor="#451A03" />
        </linearGradient>
      </defs>

      {/* Tree Ground Shadow */}
      <ellipse cx="250" cy="518" rx="145" ry="22" fill="rgba(0,0,0,0.22)" />

      {/* Trunk & Branches */}
      <path
        d="M218 515 Q 225 390 220 285 L 155 215 L 175 198 L 235 258 L 250 190 L 270 190 L 272 252 L 335 205 L 350 225 L 282 285 Q 278 395 292 515 Z"
        fill={isChalk ? 'none' : 'url(#trunkGrad)'}
        stroke={isComic ? '#111827' : isChalk ? '#FDE68A' : '#451A03'}
        strokeWidth={isComic ? 5 : isChalk ? 3.5 : 1}
      />

      {/* Canopy */}
      <g transform={\`translate(250, 200) rotate(\${sway}) translate(-250, -200)\`}>
        <circle cx="155" cy="195" r="82" fill={isChalk ? 'none' : 'url(#canopyLight)'} stroke={strokeCol} strokeWidth={strokeW} />
        <circle cx="345" cy="195" r="82" fill={isChalk ? 'none' : 'url(#canopyLight)'} stroke={strokeCol} strokeWidth={strokeW} />
        <circle cx="185" cy="122" r="88" fill={isChalk ? 'none' : 'url(#canopyLight)'} stroke={strokeCol} strokeWidth={strokeW} />
        <circle cx="315" cy="122" r="88" fill={isChalk ? 'none' : 'url(#canopyLight)'} stroke={strokeCol} strokeWidth={strokeW} />
        <circle cx="250" cy="155" r="105" fill={isChalk ? 'none' : 'url(#canopyLight)'} stroke={strokeCol} strokeWidth={strokeW} />

        {/* Hanging Apples */}
        {[
          { x: 145, y: 185 },
          { x: 245, y: 108 },
          { x: 340, y: 175 },
        ].map((pos, idx) => (
          <g key={idx} transform={\`translate(\${pos.x}, \${pos.y}) scale(0.38)\`}>
            <AnimatedApple size={90} variant={variant} />
          </g>
        ))}
      </g>

      {/* Hero Falling Apple */}
      <g transform={\`translate(\${308 + wobble}, \${225 + dropY}) scale(0.55)\`}>
        <AnimatedApple size={95} variant={variant} showMotionLines={clampedFall > 0.08 && clampedFall < 0.95} />
      </g>
    </svg>
  );
};

export interface ComicBurstProps {
  text: string;
  bgColor?: string;
  borderColor?: string;
  textColor?: string;
  scale?: number;
}

export const ComicBurst: React.FC<ComicBurstProps> = ({
  text,
  bgColor = '#FACC15',
  borderColor = '#111827',
  textColor = '#EF4444',
  scale = 1,
}) => {
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transform: \`scale(\${scale})\` }}>
      <svg width="260" height="160" viewBox="0 0 260 160" style={{ overflow: 'visible' }}>
        <polygon
          points="130,8 156,40 202,16 196,58 248,66 208,96 244,132 190,126 178,154 132,128 84,154 74,124 18,132 54,94 12,62 66,56 58,14 106,40"
          fill={borderColor}
          transform="translate(6, 6)"
        />
        <polygon
          points="130,8 156,40 202,16 196,58 248,66 208,96 244,132 190,126 178,154 132,128 84,154 74,124 18,132 54,94 12,62 66,56 58,14 106,40"
          fill={bgColor}
          stroke={borderColor}
          strokeWidth="6"
          strokeLinejoin="round"
        />
      </svg>
      <span
        style={{
          position: 'absolute',
          fontSize: 34,
          fontWeight: 900,
          fontStyle: 'italic',
          color: textColor,
          textShadow: '2px 2px 0 #111827',
          letterSpacing: '0.03em',
          transform: 'rotate(-6deg)',
        }}
      >
        {text}
      </span>
    </div>
  );
};

export interface ChalkAnnotationProps {
  label: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color?: string;
  progress?: number;
}

export const ChalkAnnotation: React.FC<ChalkAnnotationProps> = ({
  label,
  x1,
  y1,
  x2,
  y2,
  color = '#FDE047',
  progress = 1,
}) => {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const clamped = Math.max(0, Math.min(1, progress));
  const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={len}
        strokeDashoffset={len * (1 - clamped)}
      />
      {clamped > 0.85 && (
        <polygon
          points="0,-9 18,0 0,9"
          fill={color}
          transform={\`translate(\${x2}, \${y2}) rotate(\${angle})\`}
        />
      )}
      {clamped > 0.35 && (
        <text
          x={midX}
          y={midY - 14}
          textAnchor="middle"
          fill={color}
          fontSize="26"
          fontWeight="800"
          opacity={Math.min(1, (clamped - 0.35) * 2)}
        >
          {label}
        </text>
      )}
    </g>
  );
};

export interface OrbitSystemProps {
  size?: number;
  planetColor?: string;
  orbitColor?: string;
  speed?: number;
  variant?: 'glow' | 'cgi' | 'flat' | 'chalk';
  showVelocityArrow?: boolean;
}

export const OrbitSystem: React.FC<OrbitSystemProps> = ({
  size = 660,
  planetColor = '#38BDF8',
  orbitColor = '#FACC15',
  speed = 1,
  variant = 'glow',
  showVelocityArrow = true,
}) => {
  const frame = useCurrentFrame();
  const angle = (frame * 0.045 * speed) % (Math.PI * 2);
  const rx = 185;
  const ry = 105;
  const satX = 250 + Math.cos(angle) * rx;
  const satY = 210 + Math.sin(angle) * ry;
  const tanAngle = Math.atan2(Math.cos(angle) * ry, -Math.sin(angle) * rx) * (180 / Math.PI);

  return (
    <svg width={size} height={size * 0.84} viewBox="0 0 500 420" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id="earthCore" cx="35%" cy="32%" r="70%">
          <stop offset="0%" stopColor="#93C5FD" />
          <stop offset="55%" stopColor={planetColor} />
          <stop offset="100%" stopColor="#0F172A" />
        </radialGradient>
      </defs>

      {/* Orbit Ring */}
      <ellipse
        cx="250"
        cy="210"
        rx={rx}
        ry={ry}
        fill="none"
        stroke={orbitColor}
        strokeWidth="3.5"
        strokeDasharray="10 10"
        opacity="0.85"
      />

      {/* Earth / Planet */}
      <circle
        cx="250"
        cy="210"
        r="78"
        fill={variant === 'chalk' ? 'none' : 'url(#earthCore)'}
        stroke={variant === 'chalk' ? '#93C5FD' : 'rgba(255,255,255,0.28)'}
        strokeWidth="3"
      />
      {/* Stylized Continents */}
      <path d="M210 185 Q 235 168 258 188 Q 245 215 222 212 Z" fill="#4ADE80" opacity={variant === 'chalk' ? 0.5 : 0.85} />
      <path d="M262 218 Q 290 212 302 238 Q 275 258 258 238 Z" fill="#4ADE80" opacity={variant === 'chalk' ? 0.5 : 0.85} />

      {/* Orbiting Satellite / Moon */}
      <g transform={\`translate(\${satX}, \${satY})\`}>
        {showVelocityArrow && (
          <g transform={\`rotate(\${tanAngle})\`}>
            <line x1="0" y1="0" x2="54" y2="0" stroke="#F97316" strokeWidth="4" strokeLinecap="round" />
            <polygon points="52,-7 66,0 52,7" fill="#F97316" />
          </g>
        )}
        <circle cx="0" cy="0" r="18" fill="#E2E8F0" stroke="#1E293B" strokeWidth="3" />
        <circle cx="-5" cy="-5" r="4" fill="#94A3B8" />
      </g>
    </svg>
  );
};

export interface EditorialShowcaseCardProps {
  title: string;
  subtitle?: string;
  items: string[];
  checkedCount?: number;
}

export const EditorialShowcaseCard: React.FC<EditorialShowcaseCardProps> = ({
  title,
  subtitle,
  items,
  checkedCount = items.length,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 880,
        backgroundColor: '#FFFFFF',
        borderRadius: 32,
        padding: '38px 40px',
        boxShadow: '0 24px 60px rgba(15, 23, 42, 0.12)',
        border: '1px solid rgba(15, 23, 42, 0.08)',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontSize: 40, fontWeight: 800, color: '#0F172A', marginBottom: 8, overflowWrap: 'break-word' }}>
        {title}
      </div>
      {subtitle && (
        <div style={{ fontSize: 24, fontWeight: 500, color: '#64748B', marginBottom: 26, overflowWrap: 'break-word' }}>
          {subtitle}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {items.map((item, idx) => {
          const itemPop = spring({
            frame: Math.max(0, frame - idx * 8),
            fps,
            config: { damping: 14, stiffness: 180 },
          });
          const isChecked = idx < checkedCount;
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '16px 22px',
                borderRadius: 18,
                backgroundColor: isChecked ? '#F0FDF4' : '#F8FAFC',
                border: isChecked ? '1.5px solid #86EFAC' : '1.5px solid #E2E8F0',
                transform: \`translateY(\${(1 - itemPop) * 16}px)\`,
                opacity: itemPop,
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  backgroundColor: isChecked ? '#22C55E' : '#CBD5E1',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: 20,
                  flexShrink: 0,
                }}
              >
                {isChecked ? '✓' : idx + 1}
              </div>
              <span style={{ fontSize: 26, fontWeight: 700, color: '#0F172A', overflowWrap: 'break-word' }}>
                {item}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
`;
}


import { GENERIC_CRAFT_CODE, GENERIC_CRAFT_IMPORTS } from './scene-craft-generic.js';

/**
 * Full SceneCraft.tsx = signature-world components + generic beat-friendly components
 * (KineticWords, StatCounter, IconPop, RevealList, SplitCompare, ParticleBurst, useBeat).
 */
export function buildSceneCraftCode(): string {
  const base = buildBaseSceneCraftCode();
  const remotionImport = "import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';";
  return base.replace(remotionImport, `${remotionImport}\n${GENERIC_CRAFT_IMPORTS}`) + GENERIC_CRAFT_CODE;
}
