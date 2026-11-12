import fs from 'node:fs';
import type { WordTiming } from '../types/asset.js';
import { parseWavBuffer } from '../stages/bridge/audio-aligner.js';

/**
 * Viseme engine for Bahasa Indonesia (spelling is ~phonetic, so text is a reliable viseme source).
 *
 * REST = mouth closed/relaxed, M = lips pressed (m/b/p), A = wide open, E/I = spread (teeth),
 * O = round open, U = small round (pucker), C = medium open (consonant / schwa transitions)
 *
 * Text gives the SHAPE sequence inside each word (distributed over the word's real timing);
 * when a real voiceover WAV exists, per-frame loudness gates the mouth closed during silence
 * and softens wide shapes on quiet syllables.
 */
export type Viseme = 'REST' | 'M' | 'A' | 'E' | 'I' | 'O' | 'U' | 'C';

/** [localFrame, viseme] change points, sorted */
export type VisemeTrack = Array<[number, Viseme]>;

const VOWEL: Record<string, Viseme> = { a: 'A', i: 'I', e: 'C', 'é': 'E', o: 'O', u: 'U' };
const DIGIT_PATTERN: Viseme[] = ['C', 'A', 'U', 'E', 'A', 'O'];

export function wordToVisemes(word: string): Viseme[] {
  const w = word.toLowerCase().normalize('NFC');
  if (/\d/.test(w)) {
    // numbers are spoken as several syllables ("dua ratus sembilan puluh enam") -> generic open/close rhythm
    const n = Math.min(8, 2 + w.replace(/\D/g, '').length * 2);
    return Array.from({ length: n }, (_, i) => DIGIT_PATTERN[i % DIGIT_PATTERN.length]);
  }
  const letters = w.replace(/[^a-zé]/g, '');
  const out: Viseme[] = [];
  for (let i = 0; i < letters.length; i++) {
    const ch = letters[i];
    let v: Viseme | null = null;
    if (VOWEL[ch]) {
      v = VOWEL[ch];
      // 'e' at word end or before r/l/ng is usually open-ish in Indonesian; keep C (schwa) otherwise
      if (ch === 'e' && (i === letters.length - 1 || /[rl]/.test(letters[i + 1] || ''))) v = 'E';
    } else if (ch === 'm' || ch === 'b' || ch === 'p') {
      v = 'M';
    } else if ((ch === 'f' || ch === 'v' || ch === 'w') && i < letters.length - 1) {
      v = 'U';
    }
    if (v && out[out.length - 1] !== v) out.push(v);
  }
  return out.length > 0 ? out : ['C'];
}

function loudnessPerFrame(wavPath: string, fps: number): Float32Array | null {
  try {
    const parsed = parseWavBuffer(fs.readFileSync(wavPath));
    if (!parsed) return null;
    const hop = parsed.sampleRate / fps;
    const frames = Math.ceil(parsed.samples.length / hop);
    const rms = new Float32Array(frames);
    let max = 0;
    for (let f = 0; f < frames; f++) {
      const start = Math.floor(f * hop);
      const end = Math.min(parsed.samples.length, Math.floor((f + 1) * hop));
      let sum = 0;
      for (let i = start; i < end; i++) sum += parsed.samples[i] * parsed.samples[i];
      rms[f] = Math.sqrt(sum / Math.max(1, end - start));
      if (rms[f] > max) max = rms[f];
    }
    if (max < 1e-4) return null; // silent (dummy TTS) -> text-only visemes
    for (let f = 0; f < frames; f++) rms[f] /= max;
    return rms;
  } catch {
    return null;
  }
}

/**
 * Builds the LOCAL viseme track for one scene.
 * @param wavPath optional voiceover file; enables loudness gating when it contains real speech
 */
export function buildVisemeTrack(wordTimings: WordTiming[], durationInFrames: number, fps: number, wavPath?: string): VisemeTrack {
  const perFrame: Viseme[] = new Array(Math.max(1, durationInFrames)).fill('REST');
  const minSeg = 2;

  wordTimings.forEach((wt, idx) => {
    const start = Math.max(0, wt.startFrame);
    const next = idx < wordTimings.length - 1 ? wordTimings[idx + 1].startFrame : durationInFrames;
    // close the mouth only on real pauses; otherwise flow into the next word
    const end = Math.min(durationInFrames, next - start <= 4 ? next : Math.max(start + 1, wt.endFrame));
    const span = end - start;
    if (span <= 0) return;
    let shapes = wordToVisemes(wt.word);
    const maxShapes = Math.max(1, Math.floor(span / minSeg));
    if (shapes.length > maxShapes) {
      // keep vowels first when the word is spoken fast
      const step = shapes.length / maxShapes;
      shapes = Array.from({ length: maxShapes }, (_, i) => shapes[Math.floor(i * step)]);
    }
    const seg = span / shapes.length;
    shapes.forEach((v, i) => {
      const a = Math.round(start + i * seg);
      const b = Math.round(start + (i + 1) * seg);
      for (let f = a; f < b && f < perFrame.length; f++) perFrame[f] = v;
    });
  });

  const loud = wavPath ? loudnessPerFrame(wavPath, fps) : null;
  if (loud) {
    for (let f = 0; f < perFrame.length; f++) {
      const l = loud[Math.min(loud.length - 1, f)] ?? 0;
      if (l < 0.06) perFrame[f] = 'REST';
      else if (l < 0.22 && (perFrame[f] === 'A' || perFrame[f] === 'O')) perFrame[f] = 'C';
      else if (perFrame[f] === 'REST' && l > 0.3) perFrame[f] = 'C';
    }
  }

  // smooth: remove 1-frame blips
  for (let f = 1; f < perFrame.length - 1; f++) {
    if (perFrame[f] !== perFrame[f - 1] && perFrame[f] !== perFrame[f + 1] && perFrame[f - 1] === perFrame[f + 1]) {
      perFrame[f] = perFrame[f - 1];
    }
  }

  const track: VisemeTrack = [];
  perFrame.forEach((v, f) => {
    if (track.length === 0 || track[track.length - 1][1] !== v) track.push([f, v]);
  });
  return track;
}
