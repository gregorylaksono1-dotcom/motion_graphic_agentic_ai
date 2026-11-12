import type { WordTiming } from '../../types/asset.js';
import type { BeatSlot } from '../../types/timeline.js';

export interface BeatGridOptions {
  durationInFrames: number;
  fps: number;
  wordTimings: WordTiming[];
  beatIntervalSec: number;
  /** Hook scene: tighter beats during the first 3 seconds */
  isHook?: boolean;
  /** Storyboard visual beat ideas (LLM 1), distributed over the slots */
  visualBeats?: string[];
}

/**
 * Builds a beat grid for one scene: a slot roughly every `beatIntervalSec`, snapped to
 * the most "hittable" spoken word nearby (phrase starts, numbers, long content words),
 * so every visual change lands on the narration instead of on an arbitrary timer.
 */
export function computeBeatSlots(opts: BeatGridOptions): BeatSlot[] {
  const { durationInFrames, fps, wordTimings, beatIntervalSec, isHook, visualBeats = [] } = opts;
  const intervalF = Math.max(fps, Math.round(beatIntervalSec * fps));
  const endGuard = durationInFrames - Math.round(0.5 * fps);

  const candidates = wordTimings.map((wt, i) => ({
    frame: wt.startFrame,
    word: wt.word,
    score: scoreWord(wt, i > 0 ? wordTimings[i - 1] : undefined),
  }));

  const frames: Array<{ frame: number; word: string }> = [{ frame: 0, word: '' }];
  let last = 0;

  // Guard against infinite loops with a hard cap
  for (let guard = 0; guard < 64; guard++) {
    const step = isHook && last < 3 * fps ? Math.round(intervalF * 0.7) : intervalF;
    const target = last + step;
    if (target > endGuard) break;

    const window = Math.round(step * 0.35);
    const minFrame = last + Math.round(step * 0.6);
    let best: { frame: number; word: string; value: number } | null = null;

    for (const c of candidates) {
      if (c.frame < minFrame || c.frame < target - window || c.frame > target + window || c.frame > endGuard) continue;
      const value = c.score - (Math.abs(c.frame - target) / window) * 1.5;
      if (!best || value > best.value) best = { frame: c.frame, word: c.word, value };
    }

    // Land the visual 1 frame before the word starts so the eye and ear hit together
    const frame = best ? Math.max(minFrame, best.frame - 1) : target;
    frames.push({ frame, word: best?.word || '' });
    last = frame;
  }

  return frames.map((f, idx) => {
    const next = idx < frames.length - 1 ? frames[idx + 1].frame : durationInFrames;
    const phrase = wordTimings
      .filter((wt) => wt.startFrame >= f.frame && wt.startFrame < next)
      .map((wt) => wt.word)
      .join(' ');
    const suggestedVisual =
      visualBeats.length > 0 ? visualBeats[Math.min(visualBeats.length - 1, Math.floor((idx * visualBeats.length) / frames.length))] : '';

    return {
      index: idx,
      localFrame: f.frame,
      anchorWord: f.word,
      phrase,
      suggestedVisual,
    };
  });
}

function scoreWord(wt: WordTiming, prev?: WordTiming): number {
  const clean = wt.word.replace(/[^\p{L}\p{N}%]/gu, '');
  let score = 1;
  if (!prev || prev.clauseBreakAfter) score += 2; // phrase start
  if (/\d/.test(clean)) score += 2; // numbers are the best visual hits
  if (clean.length >= 7) score += 1; // content words
  if (/^(dan|yang|di|ke|dari|itu|ini|the|a|an|and|of|to|in)$/i.test(clean)) score -= 2; // filler words
  return score;
}

/** Human-readable beat grid for LLM prompts */
export function formatBeatSlots(slots: BeatSlot[], fps: number): string {
  return slots
    .map(
      (s) =>
        `  Beat ${s.index} @ local f${s.localFrame} (${(s.localFrame / fps).toFixed(1)}s)` +
        (s.anchorWord ? ` on word "${s.anchorWord}"` : s.index === 0 ? ' [scene entry]' : '') +
        (s.phrase ? ` | narration: "${s.phrase}"` : '') +
        (s.suggestedVisual ? ` | storyboard idea: ${s.suggestedVisual}` : '')
    )
    .join('\n');
}

/** Stats for logging / QA */
export function beatStats(frames: number[], durationInFrames: number, fps: number): { avgGapSec: number; maxGapSec: number } {
  const all = [...frames].sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 0; i < all.length; i++) {
    const next = i < all.length - 1 ? all[i + 1] : durationInFrames;
    gaps.push(next - all[i]);
  }
  const avg = gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length);
  return { avgGapSec: Number((avg / fps).toFixed(2)), maxGapSec: Number((Math.max(...gaps) / fps).toFixed(2)) };
}
