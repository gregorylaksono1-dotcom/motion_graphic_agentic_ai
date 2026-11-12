import { RemotionProjectWriter } from './generator/writer.js';
import type { DirectorBlueprint } from './types/director.js';
import type { SingleFileResult } from './types/code.js';

/**
 * Generates a 9:16 vertical short-form modular Remotion project template
 * showcasing glowing gradients, lucide-react vector icons, glassmorphism cards, and kinetic captions.
 */
async function runDemo() {
  console.log('========================================================================');
  console.log('🎬 Running Offline Demo: 9:16 Vertical Motion Graphics (1080x1920)');
  console.log('========================================================================\n');

  const writer = new RemotionProjectWriter('./output');

  const blueprint: DirectorBlueprint = {
    projectName: 'AICodeAssistantVertical',
    mainCompositionName: 'MainComposition',
    mainFilePath: 'components/MainComposition.tsx',
    width: 1080,
    height: 1920,
    fps: 30,
    totalDurationInFrames: 150,
    sharedTypesCode: `// Auto-generated Contract: types.ts
export interface KineticTitleProps {
  headline?: string;
  tagline?: string;
}

export interface FeaturePillarsProps {
  features?: string[];
}
`,
    sharedThemeCode: `// Auto-generated Contract: constants/theme.ts
export const THEME = {
  colors: {
    bg: '#070812',
    surface: 'rgba(20, 24, 46, 0.72)',
    primary: '#00ffcc',
    secondary: '#ff007f',
    accent: '#7928ca',
    text: '#ffffff',
    textMuted: '#a3b3cc',
    border: 'rgba(255, 255, 255, 0.14)',
  },
  typography: {
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    sizes: {
      hero: 84,
      title: 52,
      body: 30,
      caption: 38,
    },
  },
};
`,
    backgroundComponent: {
      componentName: 'BackgroundLayer',
      filePath: 'components/common/BackgroundLayer.tsx',
      description: 'Rich dark radial gradient mesh with drifting neon orbs and subtle dot matrix',
    },
    directorNotes: '9:16 vertical high-retention layout with safe-zone captions',
    scenes: [
      {
        sceneNumber: 1,
        componentName: 'KineticTitle',
        filePath: 'components/scenes/KineticTitle.tsx',
        visualStyleTag: 'glow-sketch',
        transitionIn: 'fade',
        captionTheme: 'light-pill',
        startFrame: 0,
        durationInFrames: 75,
        captionText: 'Era baru coding otomatis sudah dimulai sekarang',
        expectedPropsInterface: 'KineticTitleProps',
        keyframeEvents: ['Frame 0-15: Badge & icon spring in', 'Frame 15-65: Word-by-word caption highlight'],
        visualElements: ['Glowing Sparkles icon badge', 'Neon gradient headline', 'Kinetic lower-third captions'],
        beats: [],
        highlightWords: [],
      },
      {
        sceneNumber: 2,
        componentName: 'FeaturePillars',
        filePath: 'components/scenes/FeaturePillars.tsx',
        visualStyleTag: 'editorial-ui',
        transitionIn: 'wipe-right',
        captionTheme: 'dark-pill',
        startFrame: 70,
        durationInFrames: 80,
        captionText: 'Terintegrasi MCP, multi model, dan siap render video',
        expectedPropsInterface: 'FeaturePillarsProps',
        keyframeEvents: ['Frame 0-35: Staggered Bento glassmorphism cards slide up'],
        visualElements: ['Vertical Bento feature cards with Lucide icons', 'Kinetic lower-third captions'],
        beats: [],
        highlightWords: [],
      },
    ],
  };

  await writer.cleanComponentsDir();
  await writer.writeContractFiles(blueprint);
  await writer.writeKineticCaptionsComponent();

  const componentsCode: SingleFileResult[] = [
    {
      filePath: 'components/common/BackgroundLayer.tsx',
      exportedSymbols: ['BackgroundLayer'],
      notes: 'Multi-layered 9:16 dark gradient mesh with drifting orbs and dot matrix',
      code: `import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { THEME } from '../../constants/theme';

export const BackgroundLayer: React.FC = () => {
  const frame = useCurrentFrame();
  const orb1X = Math.sin(frame / 30) * 120;
  const orb1Y = Math.cos(frame / 25) * 140;
  const orb2X = Math.cos(frame / 28) * 140;
  const orb2Y = Math.sin(frame / 32) * 120;
  const gridScale = interpolate(frame, [0, 150], [1, 1.08]);

  return (
    <AbsoluteFill
      style={{
        background: \`radial-gradient(circle at 50% 25%, #131633 0%, \${THEME.colors.bg} 75%)\`,
        overflow: 'hidden',
      }}
    >
      {/* Drifting Neon Orbs */}
      <div
        style={{
          position: 'absolute',
          width: 700,
          height: 700,
          borderRadius: '50%',
          background: \`radial-gradient(circle, rgba(0, 255, 204, 0.25) 0%, transparent 70%)\`,
          top: 150 + orb1Y,
          left: -150 + orb1X,
          filter: 'blur(40px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 750,
          height: 750,
          borderRadius: '50%',
          background: \`radial-gradient(circle, rgba(255, 0, 127, 0.22) 0%, transparent 70%)\`,
          bottom: 180 + orb2Y,
          right: -180 + orb2X,
          filter: 'blur(40px)',
        }}
      />
      {/* Subtle Dot Matrix */}
      <div
        style={{
          position: 'absolute',
          inset: -60,
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.12) 1.5px, transparent 1.5px)',
          backgroundSize: '42px 42px',
          transform: \`scale(\${gridScale})\`,
          opacity: 0.45,
        }}
      />
    </AbsoluteFill>
  );
};
`,
    },
    {
      filePath: 'components/scenes/KineticTitle.tsx',
      exportedSymbols: ['KineticTitle'],
      notes: '9:16 vertical hero card with Lucide Sparkles icon and word-by-word captions',
      code: `import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Sparkles } from 'lucide-react';
import type { KineticTitleProps } from '../../types';
import { THEME } from '../../constants/theme';

export const KineticTitle: React.FC<Partial<KineticTitleProps>> = ({
  headline = 'AI CODE ASSISTANT',
  tagline = 'Autonomous Motion Graphics',
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const scale = spring({ frame, fps, config: { damping: 12, mass: 0.8 } });
  const exitOpacity = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const floatY = Math.sin(frame / 16) * 8;

  const words = 'Era baru coding otomatis sudah dimulai sekarang'.split(' ');
  const activeWordIdx = Math.floor(
    interpolate(frame, [5, durationInFrames - 10], [0, words.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );

  return (
    <AbsoluteFill
      style={{
        padding: '140px 64px 200px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontFamily: THEME.typography.fontFamily,
        opacity: exitOpacity,
      }}
    >
      {/* Top Pill Badge */}
      <div
        style={{
          padding: '14px 28px',
          borderRadius: 999,
          background: 'rgba(0, 255, 204, 0.12)',
          border: '1px solid rgba(0, 255, 204, 0.35)',
          color: THEME.colors.primary,
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: 3,
          transform: \`scale(\${scale})\`,
        }}
      >
        NEXT-GEN WORKFLOW
      </div>

      {/* Center Hero Glass Card */}
      <div
        style={{
          width: '100%',
          padding: '64px 44px',
          borderRadius: 36,
          background: THEME.colors.surface,
          border: \`1px solid \${THEME.colors.border}\`,
          backdropFilter: 'blur(24px)',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.55)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          transform: \`scale(\${scale}) translateY(\${floatY}px)\`,
        }}
      >
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: 32,
            background: \`linear-gradient(135deg, \${THEME.colors.primary}, \${THEME.colors.accent})\`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 36,
            boxShadow: '0 0 40px rgba(0, 255, 204, 0.4)',
          }}
        >
          <Sparkles size={60} color="#070812" strokeWidth={2.2} />
        </div>

        <h1
          style={{
            fontSize: THEME.typography.sizes.hero,
            fontWeight: 900,
            lineHeight: 1.05,
            margin: 0,
            background: \`linear-gradient(135deg, #ffffff 10%, \${THEME.colors.primary} 60%, \${THEME.colors.secondary} 100%)\`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {headline}
        </h1>
        <p style={{ fontSize: 32, color: THEME.colors.textMuted, marginTop: 24, marginBottom: 0 }}>
          {tagline}
        </p>
      </div>

      {/* Lower-Third Kinetic Captions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, padding: '0 20px' }}>
        {words.map((w, i) => (
          <span
            key={i}
            style={{
              fontSize: THEME.typography.sizes.caption,
              fontWeight: 800,
              padding: '6px 12px',
              borderRadius: 12,
              backgroundColor: i === activeWordIdx ? THEME.colors.primary : 'rgba(0,0,0,0.45)',
              color: i === activeWordIdx ? '#070812' : '#ffffff',
            }}
          >
            {w}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
`,
    },
    {
      filePath: 'components/scenes/FeaturePillars.tsx',
      exportedSymbols: ['FeaturePillars'],
      notes: 'Vertical Bento feature stack with Lucide icons and synchronized captions',
      code: `import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Cpu, Layers, Zap } from 'lucide-react';
import type { FeaturePillarsProps } from '../../types';
import { THEME } from '../../constants/theme';

export const FeaturePillars: React.FC<Partial<FeaturePillarsProps>> = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const items = [
    { title: 'MCP Integrated', sub: 'Koneksi tool & API real-time', Icon: Layers, color: THEME.colors.primary },
    { title: 'Model Agnostic', sub: 'Bebas pilih GPT, Gemini, atau Claude', Icon: Cpu, color: THEME.colors.secondary },
    { title: 'Auto Render 9:16', sub: 'Langsung siap jadi konten Reels/Shorts', Icon: Zap, color: '#ffb703' },
  ];

  const entryOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const words = 'Terintegrasi MCP, multi model, dan siap render video'.split(' ');
  const activeWordIdx = Math.floor(
    interpolate(frame, [5, durationInFrames - 8], [0, words.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );

  return (
    <AbsoluteFill
      style={{
        padding: '160px 64px 200px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontFamily: THEME.typography.fontFamily,
        opacity: entryOpacity,
      }}
    >
      <h2 style={{ fontSize: 56, fontWeight: 900, color: '#ffffff', margin: 0, textAlign: 'center' }}>
        Kenapa Harus Ini?
      </h2>

      {/* Vertical Bento Stack */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 28 }}>
        {items.map(({ title, sub, Icon, color }, i) => {
          const cardSpring = spring({ frame: frame - i * 8, fps, config: { damping: 12, stiffness: 130 } });
          return (
            <div
              key={i}
              style={{
                width: '100%',
                padding: '32px 36px',
                borderRadius: 28,
                background: THEME.colors.surface,
                border: \`1px solid \${THEME.colors.border}\`,
                backdropFilter: 'blur(20px)',
                display: 'flex',
                alignItems: 'center',
                gap: 28,
                transform: \`translateY(\${(1 - cardSpring) * 60}px) scale(\${cardSpring})\`,
                opacity: cardSpring,
              }}
            >
              <div
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: 22,
                  background: \`\${color}22\`,
                  border: \`1px solid \${color}66\`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon size={42} color={color} />
              </div>
              <div>
                <div style={{ fontSize: 34, fontWeight: 800, color: '#ffffff' }}>{title}</div>
                <div style={{ fontSize: 24, color: THEME.colors.textMuted, marginTop: 6 }}>{sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lower-Third Kinetic Captions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
        {words.map((w, i) => (
          <span
            key={i}
            style={{
              fontSize: THEME.typography.sizes.caption,
              fontWeight: 800,
              padding: '6px 12px',
              borderRadius: 12,
              backgroundColor: i === activeWordIdx ? THEME.colors.secondary : 'rgba(0,0,0,0.45)',
              color: '#ffffff',
            }}
          >
            {w}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
`,
    },
    {
      filePath: 'components/MainComposition.tsx',
      exportedSymbols: ['MainComposition'],
      notes: '9:16 vertical composition',
      code: `import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { BackgroundLayer } from './common/BackgroundLayer';
import { KineticTitle } from './scenes/KineticTitle';
import { FeaturePillars } from './scenes/FeaturePillars';

export const MainComposition: React.FC = () => {
  return (
    <AbsoluteFill>
      <Sequence from={0} durationInFrames={150}>
        <BackgroundLayer />
      </Sequence>
      <Sequence from={0} durationInFrames={75}>
        <KineticTitle />
      </Sequence>
      <Sequence from={70} durationInFrames={80}>
        <FeaturePillars />
      </Sequence>
    </AbsoluteFill>
  );
};
`,
    },
  ];

  for (const comp of componentsCode) {
    await writer.writeComponentFile(comp);
  }

  const finalized = await writer.finalizeProject(blueprint, '9:16 Vertical short-form motion graphics demo');

  console.log('\n🎉 9:16 Demo project generated successfully!');
  console.log(`- Dimensions: ${blueprint.width}x${blueprint.height} (9:16)`);
  console.log(`- Entry:      ${finalized.indexPath}`);
}

runDemo().catch(console.error);
