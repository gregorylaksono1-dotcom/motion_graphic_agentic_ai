import type { TimedStoryboard, TimedScene } from '../../types/timeline.js';
import type { DirectorBlueprint, DirectorBeat, ChoreographedScenePlan, BeatAction, SfxId } from '../../types/director.js';
import type { StyleProfile } from '../../styles/presets.js';
import { beatStats } from '../bridge/beat-grid.js';
import { isDarkWorld } from '../../styles/genome.js';
import type { WordTiming } from '../../types/asset.js';

export interface AvatarPoseInfo {
  id: string;
  hint: string;
}

export interface EnforceOptions {
  /** Poses of the presenter avatar (when --avatar is used); beats get validated/assigned poses */
  avatarPoses?: AvatarPoseInfo[];
}

/** Normalizes a spoken token for matching: lowercase, strip punctuation, unify decimal separators */
export function normalizeToken(word: string): string {
  return (word || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/(\d)[.,](\d)/g, '$1$2')
    .replace(/[^\p{L}\p{N}%]/gu, '');
}

/**
 * Resolves an anchor word to the LOCAL frame where it is spoken (1 frame early so eye & ear hit together).
 * Picks the occurrence nearest to `nearFrame`. Supports multi-word anchors (matches the first word).
 */
export function resolveAnchorFrame(wordTimings: WordTiming[] | undefined, anchorWord: string, nearFrame: number): number | null {
  if (!wordTimings || wordTimings.length === 0 || !anchorWord) return null;
  const target = normalizeToken(anchorWord.trim().split(/\s+/)[0]);
  if (!target) return null;
  let best: { frame: number; dist: number } | null = null;
  for (const wt of wordTimings) {
    const w = normalizeToken(wt.word);
    const match = w === target || (target.length >= 4 && (w.startsWith(target) || target.startsWith(w) && w.length >= 4));
    if (!match) continue;
    const dist = Math.abs(wt.startFrame - nearFrame);
    if (!best || dist < best.dist) best = { frame: Math.max(0, wt.startFrame - 1), dist };
  }
  return best ? best.frame : null;
}

const FILLER_ACTIONS: BeatAction[] = ['camera-punch', 'element-enter', 'highlight', 'reveal'];

function defaultSfxFor(action: BeatAction, style: StyleProfile, isSceneEntry: boolean, emphasis: DirectorBeat['emphasis']): SfxId {
  if (isSceneEntry) return 'whoosh';
  // Connective beats stay light: a soft swoosh on reframes, nothing on highlights (avoids SFX fatigue)
  if (emphasis === 'low') {
    if (action === 'element-enter' || action === 'character-react') return 'pop';
    if (action === 'highlight') return 'none';
    return 'swoosh-soft';
  }
  switch (action) {
    case 'counter':
      return 'click';
    case 'burst':
    case 'shake':
      return 'impact';
    case 'text-slam':
      return style.sfxPack === 'cinematic' ? 'impact' : 'pop';
    case 'highlight':
      return 'ding';
    case 'visual-swap':
    case 'reveal':
      return 'swoosh-soft';
    case 'element-enter':
    case 'character-react':
      return style.sfxPack === 'tech' ? 'click' : 'pop';
    default:
      return 'none';
  }
}

/** Numbers are the best sticker material: "9,8 m/s²", "87%", "12 juta" */
function extractNumberSticker(phrase: string): string {
  const tokens = phrase.split(/\s+/).map((t) => t.replace(/[.,!?;:"“”]+$/g, ''));
  const i = tokens.findIndex((t) => /\d/.test(t));
  if (i < 0) return '';
  const next = tokens[i + 1] || '';
  const unitLike = /^(%|persen|juta|ribu|miliar|triliun|detik|menit|jam|hari|tahun|kg|km|m\/s²?|m|cm|x|kali|rb|jt|k)$/i.test(next);
  const shortNoun = /^\p{L}{2,8}$/u.test(next);
  return unitLike || shortNoun ? `${tokens[i]} ${next}` : tokens[i];
}

function sanitizeSticker(text: string): string {
  const words = (text || '').replace(/["“”]/g, '').trim().split(/\s+/).filter(Boolean).slice(0, 3);
  const joined = words.join(' ');
  return joined.length > 22 ? joined.slice(0, 22).trim() : joined;
}

/**
 * Deterministic post-processing of the Director (LLM 2) output:
 * 1. Locks frame math to the audio-derived timeline (LLMs drift on arithmetic).
 * 2. Keeps every scene inside the chosen style preset.
 * 3. Guarantees beat coverage: one beat per beat slot (≈ every 2s), fills gaps the LLM skipped,
 *    removes beats that are too close, and assigns SFX consistently.
 */
export function enforceBlueprint(
  blueprint: DirectorBlueprint,
  timed: TimedStoryboard,
  style: StyleProfile,
  options: EnforceOptions = {}
): DirectorBlueprint {
  const fps = timed.fps;
  const intervalF = Math.round(style.pacing.beatIntervalSec * fps);
  let filled = 0;

  const scenes: ChoreographedScenePlan[] = timed.timedScenes.map((ts, idx) => {
    const planned =
      blueprint.scenes.find((s) => s.sceneNumber === ts.sceneNumber) || blueprint.scenes[idx] || fallbackScenePlan(ts, style);

    const visualStyleTag = style.sceneStyles.includes(planned.visualStyleTag) ? planned.visualStyleTag : ts.visualStyleTag;
    const transitionIn = style.transitions.includes(planned.transitionIn)
      ? planned.transitionIn
      : style.transitions[idx % style.transitions.length];
    const lightWorld =
      visualStyleTag === 'editorial-ui' || (visualStyleTag.startsWith('genome') && !isDarkWorld(visualStyleTag, style.genome));
    const brutalWorld = visualStyleTag === 'neo-brutal';

    const enforced = enforceSceneBeats(planned.beats || [], ts, style, intervalF, fps);
    filled += enforced.inserted;
    const beats = options.avatarPoses && options.avatarPoses.length > 0
      ? assignAvatarPoses(enforced.beats, ts, options.avatarPoses, idx === timed.timedScenes.length - 1, fps)
      : enforced.beats.map((b) => ({ ...b, avatarPose: '' }));
    const narrationTokens = new Set(ts.ttsVoiceover.spokenText.split(/\s+/).map(normalizeToken));
    const highlightWords = (planned.highlightWords || [])
      .filter((w) => narrationTokens.has(normalizeToken(w)))
      .slice(0, 8);

    return {
      ...planned,
      sceneNumber: ts.sceneNumber,
      componentName: sanitizeComponentName(planned.componentName, ts.sceneNumber),
      filePath: `components/scenes/${sanitizeComponentName(planned.componentName, ts.sceneNumber)}.tsx`,
      visualStyleTag,
      transitionIn,
      captionTheme: brutalWorld || style.captionTheme === 'brutal-pill' ? 'brutal-pill' : lightWorld ? 'dark-pill' : 'light-pill',
      startFrame: ts.startFrame,
      durationInFrames: ts.durationInFrames,
      captionText: ts.ttsVoiceover.spokenText,
      beats,
      highlightWords,
    };
  });

  const allGaps = scenes.map((s) => beatStats(s.beats.map((b) => b.localFrame), s.durationInFrames, fps));
  const maxGap = Math.max(...allGaps.map((g) => g.maxGapSec));
  const avgGap = allGaps.reduce((a, g) => a + g.avgGapSec, 0) / Math.max(1, allGaps.length);
  const totalBeats = scenes.reduce((a, s) => a + s.beats.length, 0);
  console.log(
    `  🥁 [Beat Enforcer] ${totalBeats} beats total | avg ${avgGap.toFixed(2)}s | max gap ${maxGap.toFixed(2)}s | ${filled} beat(s) auto-filled`
  );

  return {
    ...blueprint,
    mainCompositionName: blueprint.mainCompositionName || 'MainComposition',
    mainFilePath: 'components/MainComposition.tsx',
    width: 1080,
    height: 1920,
    fps,
    totalDurationInFrames: timed.totalDurationInFrames,
    backgroundComponent: {
      componentName: 'BackgroundLayer',
      filePath: 'components/common/BackgroundLayer.tsx',
      description: blueprint.backgroundComponent?.description || 'Subtle ambient gradient matching the style palette',
    },
    scenes,
  };
}

function enforceSceneBeats(
  raw: DirectorBeat[],
  ts: TimedScene,
  style: StyleProfile,
  intervalF: number,
  fps: number
): { beats: DirectorBeat[]; inserted: number } {
  const dur = ts.durationInFrames;
  const intervalSec = intervalF / fps;
  const matchWindow = Math.round(Math.min(0.5, 0.45 * intervalSec) * fps);
  const minSpacing = Math.round(Math.min(0.55, 0.4 * intervalSec) * fps);
  // Word-anchored beats may sit closer together (e.g. a spoken list of names ~0.4s apart)
  const anchoredSpacing = Math.round(0.3 * fps);
  let inserted = 0;

  const anchored = new WeakSet<DirectorBeat>();
  const pool = raw
    .map((b) => {
      const clamped = Math.round(Math.min(Math.max(0, b.localFrame || 0), dur - 1));
      const resolved = resolveAnchorFrame(ts.wordTimings, b.anchorWord || '', clamped);
      const beat: DirectorBeat = {
        ...b,
        anchorWord: b.anchorWord || '',
        avatarPose: b.avatarPose || '',
        localFrame: resolved !== null ? Math.min(resolved, dur - 1) : clamped,
      };
      if (resolved !== null) anchored.add(beat);
      return beat;
    })
    .sort((a, b) => a.localFrame - b.localFrame);
  const used = new Set<number>();
  const result: DirectorBeat[] = [];
  const fillers = new Set<DirectorBeat>();

  // 1. One beat per slot (prefer the LLM's beat nearest to the slot)
  for (const slot of ts.beatSlots) {
    let bestIdx = -1;
    let bestDist = Infinity;
    pool.forEach((b, i) => {
      if (used.has(i)) return;
      const d = Math.abs(b.localFrame - slot.localFrame);
      if (d <= matchWindow && d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    });

    if (bestIdx >= 0) {
      used.add(bestIdx);
      const b = pool[bestIdx];
      if (anchored.has(b)) {
        result.push(b); // word-anchored: keep the real word timing
        anchored.add(result[result.length - 1]);
      } else {
        result.push({ ...b, localFrame: slot.localFrame });
      }
    } else {
      inserted++;
      const numberSticker = extractNumberSticker(slot.phrase);
      const action: BeatAction = numberSticker
        ? 'counter'
        : slot.index === 0
          ? 'element-enter'
          : FILLER_ACTIONS[slot.index % FILLER_ACTIONS.length];
      const filler: DirectorBeat = {
        localFrame: slot.localFrame,
        action,
        visual: slot.suggestedVisual || `Punch-in reframe on the hero subject while narration says "${slot.phrase}"`,
        onScreenText: numberSticker,
        emphasis: numberSticker || (slot.index === 0 && ts.sceneNumber === 1) ? 'high' : slot.index === 0 ? 'medium' : 'low',
        sfx: 'none',
        anchorWord: slot.anchorWord,
        avatarPose: '',
      };
      fillers.add(filler);
      result.push(filler);
    }
  }

  // 2. Unmatched LLM beats: replace a nearby auto-filler (the LLM's intent wins), otherwise keep if not crowding
  pool.forEach((b, i) => {
    if (used.has(i)) return;
    const crowded = result.filter((r) => {
      const gap = Math.abs(r.localFrame - b.localFrame);
      return anchored.has(b) && anchored.has(r) ? gap < anchoredSpacing : gap < minSpacing;
    });
    if (crowded.length === 0) {
      result.push(b);
    } else if (crowded.length === 1 && fillers.has(crowded[0])) {
      const idx = result.indexOf(crowded[0]);
      result[idx] = { ...b, localFrame: crowded[0].localFrame };
      fillers.delete(crowded[0]);
      inserted--;
    }
  });

  result.sort((a, b) => a.localFrame - b.localFrame);

  // 2b. Drop auto-fillers that sit too close to a real (LLM) beat, and exact duplicates
  for (let i = result.length - 1; i >= 0; i--) {
    const b = result[i];
    if (fillers.has(b) && result.some((r) => r !== b && !fillers.has(r) && Math.abs(r.localFrame - b.localFrame) < minSpacing)) {
      result.splice(i, 1);
      inserted--;
    } else if (i > 0 && result[i - 1].localFrame === b.localFrame) {
      result.splice(fillers.has(b) ? i : i - 1, 1);
    }
  }

  // 3. Close any remaining gaps longer than 1.5x the beat interval
  for (let i = 0; i < result.length; i++) {
    const next = i < result.length - 1 ? result[i + 1].localFrame : dur;
    if (next - result[i].localFrame > intervalF * 1.5 && dur - result[i].localFrame > fps) {
      inserted++;
      result.splice(i + 1, 0, {
        localFrame: Math.round(result[i].localFrame + (next - result[i].localFrame) / 2),
        action: 'camera-punch',
        visual: 'Punch-in reframe toward the most important detail',
        onScreenText: '',
        emphasis: 'low',
        sfx: 'none',
        anchorWord: '',
        avatarPose: '',
      });
    }
  }

  // 4. Normalize stickers, SFX and the scene-entry beat
  const beats = result.map((b, i) => {
    const isEntry = i === 0 && ts.sceneNumber > 1;
    const onScreenText = sanitizeSticker(b.onScreenText);
    const sfx: SfxId = b.sfx && b.sfx !== 'none' ? b.sfx : defaultSfxFor(b.action, style, isEntry, b.emphasis || 'medium');
    return { ...b, onScreenText, sfx, emphasis: b.emphasis || 'medium' };
  });

  // Avoid sticker spam: a sticker needs ≥1s of screen time before the next one replaces it
  let lastStickerFrame = -Infinity;
  for (let i = 0; i < beats.length; i++) {
    if (!beats[i].onScreenText) continue;
    if (beats[i].localFrame - lastStickerFrame < fps) beats[i] = { ...beats[i], onScreenText: '' };
    else lastStickerFrame = beats[i].localFrame;
  }

  return { beats, inserted };
}

function sanitizeComponentName(name: string, sceneNumber: number): string {
  const cleaned = (name || '').replace(/[^A-Za-z0-9_]/g, '');
  if (!cleaned || !/^[A-Z]/.test(cleaned)) return `Scene${sceneNumber}`;
  return cleaned.startsWith(`Scene${sceneNumber}`) ? cleaned : `Scene${sceneNumber}${cleaned.replace(/^Scene\d*/, '')}`;
}

function fallbackScenePlan(ts: TimedScene, style: StyleProfile): ChoreographedScenePlan {
  return {
    sceneNumber: ts.sceneNumber,
    componentName: `Scene${ts.sceneNumber}`,
    filePath: `components/scenes/Scene${ts.sceneNumber}.tsx`,
    visualStyleTag: ts.visualStyleTag,
    transitionIn: style.transitions[0],
    captionTheme: 'light-pill',
    startFrame: ts.startFrame,
    durationInFrames: ts.durationInFrames,
    captionText: ts.ttsVoiceover.spokenText,
    expectedPropsInterface: 'none',
    keyframeEvents: [ts.keyVisualAction],
    visualElements: [ts.visualConcept],
    beats: [],
    highlightWords: [],
  };
}


const POSE_RULES: Array<{ test: RegExp; poses: string[] }> = [
  { test: /\?|\b(kenapa|mengapa|apa|bagaimana|gimana|apakah|siapa|why|how|what)\b/i, poses: ['berpikir'] },
  { test: /\b(bahkan|cuma|hanya|gila|ternyata|wow|astaga|parah|padahal)\b|!/i, poses: ['kaget'] },
  { test: /\b(follow|ikuti|simpan|save|komen|comment|share|bagikan|aman|berhasil|solusi|tetap jalan|beres)\b/i, poses: ['jempol'] },
  { test: /\b(ini|lihat|perhatikan|di sini|disini|data|log|angka|dari)\b|\d/i, poses: ['menunjuk'] },
  { test: /\b(saya|aku|gue|kami|kita)\b/i, poses: ['main_char'] },
];

/**
 * Validates LLM-chosen avatar poses and fills the rest heuristically from the narration around each beat.
 * Pose changes are held ≥ 1s so the presenter does not flicker.
 */
export function assignAvatarPoses(
  beats: DirectorBeat[],
  ts: TimedScene,
  poses: AvatarPoseInfo[],
  isLastScene: boolean,
  fps: number
): DirectorBeat[] {
  const ids = new Set(poses.map((p) => p.id));
  const fallbackCycle = ['menjelaskan', 'menunjuk', 'main_char'].filter((p) => ids.has(p));
  const cycle = fallbackCycle.length > 0 ? fallbackCycle : poses.map((p) => p.id);
  const minHold = Math.round(1.0 * fps);
  let lastPose = '';
  let lastSwitch = -Infinity;
  let cycleIdx = ts.sceneNumber;

  return beats.map((b, i) => {
    let pose = ids.has(b.avatarPose) ? b.avatarPose : '';
    if (!pose) {
      const next = i < beats.length - 1 ? beats[i + 1].localFrame : ts.durationInFrames;
      const phrase = (ts.wordTimings || [])
        .filter((w) => w.startFrame >= b.localFrame - 2 && w.startFrame < next)
        .map((w) => w.word)
        .join(' ');
      if (isLastScene && i >= beats.length - 2 && ids.has('jempol')) pose = 'jempol';
      else {
        for (const rule of POSE_RULES) {
          const candidate = rule.poses.find((p) => ids.has(p));
          if (candidate && rule.test.test(phrase)) {
            pose = candidate;
            break;
          }
        }
      }
      if (!pose && (i === 0 || b.emphasis !== 'low')) pose = cycle[cycleIdx++ % cycle.length];
    }
    if (!pose || pose === lastPose || b.localFrame - lastSwitch < minHold) return { ...b, avatarPose: '' };
    lastPose = pose;
    lastSwitch = b.localFrame;
    return { ...b, avatarPose: pose };
  });
}
