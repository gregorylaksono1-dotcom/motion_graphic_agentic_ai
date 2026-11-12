import type { AvatarPack } from '../avatar/avatar-pack.js';
import type { VisemeTrack } from '../avatar/visemes.js';

export interface BrandConfig {
  chapterLabel: string;
  cornerLabel: string;
  handle: string; // "" = no handle pill
  totalScenes: number;
  sceneThemes: Record<number, 'dark' | 'light'>;
  sceneStarts: Array<[number, number]>; // [sceneNumber, globalStartFrame]
  enabled: boolean; // show the top frame (evidence layout)
}

export interface AvatarTracks {
  poses: Array<[number, string]>; // global frame -> pose id
  visemes: VisemeTrack; // global frame -> viseme
}

/** constants/presenter.ts — brand + avatar data, with static imports of the avatar PNGs */
export function buildPresenterConstants(
  brand: BrandConfig,
  avatar: { pack: AvatarPack; assetPaths: { poses: Record<string, string>; mouths: Record<string, string> }; tracks: AvatarTracks } | null
): string {
  const imports: string[] = [];
  let avatarLiteral = 'null';
  if (avatar) {
    const poseEntries: string[] = [];
    avatar.pack.poses.forEach((p, i) => {
      imports.push(`import pose_${i} from '../${avatar.assetPaths.poses[p.id]}';`);
      poseEntries.push(
        `    ${JSON.stringify(p.id)}: { src: pose_${i}, mouth: ${JSON.stringify(p.mouth)}, contentBox: ${JSON.stringify(p.contentBox)} },`
      );
    });
    const mouthEntries: string[] = [];
    Object.entries(avatar.pack.mouths).forEach(([name, m], i) => {
      imports.push(`import mouth_${i} from '../${avatar.assetPaths.mouths[name]}';`);
      mouthEntries.push(`    ${JSON.stringify(name)}: { src: mouth_${i}, w: ${m.w}, h: ${m.h} },`);
    });
    avatarLiteral = `{
  id: ${JSON.stringify(avatar.pack.id)},
  canvas: ${JSON.stringify(avatar.pack.canvas)},
  defaultPose: ${JSON.stringify(avatar.pack.defaultPose)},
  mouthReferenceWidth: ${avatar.pack.mouthReferenceWidth},
  visemeMap: ${JSON.stringify(avatar.pack.visemeMap)} as Record<string, string>,
  poses: {
${poseEntries.join('\n')}
  } as Record<string, AvatarPoseData>,
  mouths: {
${mouthEntries.join('\n')}
  } as Record<string, { src: string; w: number; h: number }>,
}`;
  }

  return `// Auto-generated: brand frame + presenter avatar data
${imports.join('\n')}

export interface AvatarPoseData {
  src: string;
  mouth: { x: number; y: number; width: number; rotate?: number };
  contentBox: { x0: number; y0: number; x1: number; y1: number };
}

export interface AvatarData {
  id: string;
  canvas: { width: number; height: number };
  defaultPose: string;
  mouthReferenceWidth: number;
  visemeMap: Record<string, string>;
  poses: Record<string, AvatarPoseData>;
  mouths: Record<string, { src: string; w: number; h: number }>;
}

export const BRAND = ${JSON.stringify(brand, null, 2)} as {
  chapterLabel: string;
  cornerLabel: string;
  handle: string;
  totalScenes: number;
  sceneThemes: Record<number, 'dark' | 'light'>;
  sceneStarts: Array<[number, number]>;
  enabled: boolean;
};

export const AVATAR: AvatarData | null = ${avatarLiteral};

export const AVATAR_POSE_TRACK: Array<[number, string]> = ${JSON.stringify(avatar?.tracks.poses ?? [])};

export const AVATAR_VISEME_TRACK: Array<[number, string]> = ${JSON.stringify(avatar?.tracks.visemes ?? [])};
`;
}

/** components/common/Presenter.tsx — BrandFrame + TalkingAvatar (global, outside scene Sequences) */
export function buildPresenterCode(): string {
  return `import React from 'react';
import { AbsoluteFill, Img, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { AVATAR, AVATAR_POSE_TRACK, AVATAR_VISEME_TRACK, BRAND } from '../../constants/presenter';
import { TOKENS } from '../../constants/genome';

/** Display box of the avatar sticker: bottom-right, head top at AVATAR_TOP, body cropped by the frame edge */
export const AVATAR_WIDTH = 560;
export const AVATAR_TOP = 1330;

function lastAtOrBefore<T>(track: Array<[number, T]>, frame: number): { value: T | null; since: number } {
  let lo = 0;
  let hi = track.length - 1;
  let idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (track[mid][0] <= frame) {
      idx = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return idx >= 0 ? { value: track[idx][1], since: track[idx][0] } : { value: null, since: 0 };
}

function currentScene(frame: number): number {
  let n = BRAND.sceneStarts[0]?.[0] ?? 1;
  for (const [scene, start] of BRAND.sceneStarts) if (start <= frame) n = scene;
  return n;
}

export const TalkingAvatar: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!AVATAR) return null;

  const poseHit = lastAtOrBefore(AVATAR_POSE_TRACK, frame);
  const poseId = poseHit.value && AVATAR.poses[poseHit.value] ? poseHit.value : AVATAR.defaultPose;
  const pose = AVATAR.poses[poseId];
  const viseme = lastAtOrBefore(AVATAR_VISEME_TRACK, frame).value || 'REST';
  const mouthName = AVATAR.visemeMap[viseme] || AVATAR.visemeMap.REST || Object.keys(AVATAR.mouths)[0];
  const mouth = AVATAR.mouths[mouthName];

  const scale = AVATAR_WIDTH / AVATAR.canvas.width;
  const pop = spring({ frame: Math.max(0, frame - poseHit.since), fps, config: { damping: 12, stiffness: 260, mass: 0.6 } });
  const switching = poseHit.value ? 1 - pop : 0;
  const breathe = Math.sin(frame / 18) * 3;
  const sway = Math.sin(frame / 47) * 0.8;

  const mScale = (pose.mouth.width / AVATAR.mouthReferenceWidth) * scale;
  const mw = mouth.w * mScale;
  const mh = mouth.h * mScale;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          right: -20,
          top: AVATAR_TOP - pose.contentBox.y0 * scale,
          width: AVATAR.canvas.width * scale,
          height: AVATAR.canvas.height * scale,
          transformOrigin: '50% 100%',
          transform: 'translateY(' + (breathe + switching * 18) + 'px) rotate(' + sway + 'deg) scale(' + (1 - switching * 0.05) + ')',
          filter: 'drop-shadow(0 14px 22px rgba(0,0,0,0.35))',
        }}
      >
        <Img src={pose.src} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        <Img
          src={mouth.src}
          style={{
            position: 'absolute',
            left: pose.mouth.x * scale - mw / 2,
            top: pose.mouth.y * scale - mh / 2,
            width: mw,
            height: mh,
            transform: 'rotate(' + (pose.mouth.rotate || 0) + 'deg)',
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

const AvatarThumb: React.FC<{ size: number }> = ({ size }) => {
  if (!AVATAR) return <div style={{ width: size, height: size, borderRadius: '50%', backgroundColor: '#FDE047' }} />;
  const pose = AVATAR.poses[AVATAR.defaultPose];
  const s = (size * 3.2) / AVATAR.canvas.width;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', position: 'relative', backgroundColor: '#E2E8F0', border: '3px solid #0B0F1A' }}>
      <Img
        src={pose.src}
        style={{
          position: 'absolute',
          width: AVATAR.canvas.width * s,
          left: size / 2 - pose.mouth.x * s,
          top: size * 0.62 - pose.mouth.y * s,
        }}
      />
    </div>
  );
};

/** Persistent frame: chapter label (top-left), blinking REC + counter (top-right), handle pill (bottom-left) */
export const BrandFrame: React.FC = () => {
  const frame = useCurrentFrame();
  const scene = currentScene(frame);
  const dark = (BRAND.sceneThemes[scene] || 'dark') === 'dark';
  const ink = dark ? '#FFFFFF' : TOKENS.palette.deep;
  const recOn = Math.floor(frame / 15) % 2 === 0;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', fontFamily: TOKENS.fonts.mono }}>
      {BRAND.enabled && (
        <div style={{ position: 'absolute', top: 56, left: 56, right: 56, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div
            style={{
              fontSize: 25,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: dark ? '#E2E8F0' : '#FFFFFF',
              backgroundColor: dark ? 'transparent' : TOKENS.palette.deep,
              padding: dark ? 0 : '6px 12px',
              borderRadius: 4,
            }}
          >
            {BRAND.chapterLabel}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 25, fontWeight: 700, letterSpacing: '0.08em', color: ink }}>
            <span style={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: TOKENS.palette.danger, opacity: recOn ? 1 : 0.15 }} />
            <span>REC {BRAND.cornerLabel}</span>
            <span style={{ color: TOKENS.palette.danger }}>
              {scene}/{BRAND.totalScenes}
            </span>
          </div>
        </div>
      )}
      {BRAND.handle && (
        <div
          style={{
            position: 'absolute',
            left: 48,
            top: 1540,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '8px 10px 8px 8px',
            backgroundColor: '#FFFFFF',
            border: '4px solid #0B0F1A',
            borderRadius: 999,
            boxShadow: '6px 6px 0 ' + TOKENS.palette.danger,
          }}
        >
          <AvatarThumb size={60} />
          <span style={{ fontSize: 28, fontWeight: 700, color: '#0B0F1A' }}>{BRAND.handle}</span>
          <span style={{ fontSize: 24, fontWeight: 800, color: TOKENS.palette.onDanger, backgroundColor: TOKENS.palette.danger, padding: '8px 18px', borderRadius: 999, fontFamily: TOKENS.fonts.body }}>
            Follow
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
};
`;
}
