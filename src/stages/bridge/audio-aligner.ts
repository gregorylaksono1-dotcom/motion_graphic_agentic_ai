import fs from 'node:fs/promises';
import type { WordTiming } from '../../types/asset.js';

export interface SpeechSegment {
  startSec: number;
  endSec: number;
}

export interface AudioAlignmentResult {
  durationSeconds: number;
  speechStartSec: number;
  speechEndSec: number;
  segments: SpeechSegment[];
  wordTimings: WordTiming[];
}

interface ParsedWav {
  sampleRate: number;
  numChannels: number;
  bitsPerSample: number;
  samples: Float32Array;
  durationSeconds: number;
}

/**
 * Parses a standard RIFF/WAVE PCM buffer (supports 16-bit & 8-bit PCM, mono/stereo, any chunk order).
 */
export function parseWavBuffer(buffer: Buffer): ParsedWav | null {
  if (buffer.length < 44) return null;
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    return null;
  }

  let offset = 12;
  let audioFormat = 1;
  let numChannels = 1;
  let sampleRate = 24000;
  let bitsPerSample = 16;
  let dataOffset = -1;
  let dataSize = 0;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkBody = offset + 8;

    if (chunkId === 'fmt ' && chunkBody + 16 <= buffer.length) {
      audioFormat = buffer.readUInt16LE(chunkBody);
      numChannels = buffer.readUInt16LE(chunkBody + 2);
      sampleRate = buffer.readUInt32LE(chunkBody + 4);
      bitsPerSample = buffer.readUInt16LE(chunkBody + 14);
    } else if (chunkId === 'data') {
      dataOffset = chunkBody;
      dataSize = Math.min(chunkSize, buffer.length - chunkBody);
      break;
    }

    offset = chunkBody + chunkSize + (chunkSize % 2);
  }

  if (dataOffset < 0 || audioFormat !== 1 || (bitsPerSample !== 16 && bitsPerSample !== 8)) {
    return null;
  }

  const bytesPerSample = bitsPerSample / 8;
  const frameSize = bytesPerSample * numChannels;
  const numFrames = Math.floor(dataSize / frameSize);
  const samples = new Float32Array(numFrames);

  for (let i = 0; i < numFrames; i++) {
    let monoSum = 0;
    for (let ch = 0; ch < numChannels; ch++) {
      const pos = dataOffset + i * frameSize + ch * bytesPerSample;
      if (bitsPerSample === 16) {
        monoSum += buffer.readInt16LE(pos) / 32768;
      } else {
        monoSum += (buffer.readUInt8(pos) - 128) / 128;
      }
    }
    samples[i] = monoSum / numChannels;
  }

  return {
    sampleRate,
    numChannels,
    bitsPerSample,
    samples,
    durationSeconds: numFrames / sampleRate,
  };
}

/**
 * Detects speech-active segments using adaptive RMS energy + hysteresis.
 */
export function detectSpeechSegments(samples: Float32Array, sampleRate: number): SpeechSegment[] {
  if (samples.length === 0) return [];

  const hopSamples = Math.max(1, Math.floor(sampleRate * 0.01)); // 10ms window
  const rmsFrames: number[] = [];

  for (let i = 0; i < samples.length; i += hopSamples) {
    const end = Math.min(samples.length, i + hopSamples);
    let sumSq = 0;
    for (let j = i; j < end; j++) {
      sumSq += samples[j] * samples[j];
    }
    rmsFrames.push(Math.sqrt(sumSq / (end - i)));
  }

  if (rmsFrames.length === 0) return [];

  const sorted = [...rmsFrames].sort((a, b) => a - b);
  const noiseFloor = sorted[Math.floor(sorted.length * 0.15)] || 0;
  const peakRms = sorted[Math.floor(sorted.length * 0.98)] || 0;

  // Guard against silent/near-flat mock audio
  if (peakRms < 0.002 || peakRms - noiseFloor < 0.0015) {
    return [];
  }

  // Adaptive threshold calibrated for TTS speech (~0.006 - 0.015 on normalized [-1, 1] PCM)
  const enterThresh = Math.max(noiseFloor * 2.5, Math.min(0.012, noiseFloor + (peakRms - noiseFloor) * 0.08));
  const exitThresh = enterThresh * 0.7;

  const minSilenceFrames = 11; // ~110ms pause splits clauses
  const minSpeechFrames = 4;  // ~40ms minimum burst

  const rawSegments: SpeechSegment[] = [];
  let inSpeech = false;
  let segStartFrame = 0;
  let silentStreak = 0;

  for (let f = 0; f < rmsFrames.length; f++) {
    const energy = rmsFrames[f];
    if (!inSpeech) {
      if (energy >= enterThresh) {
        inSpeech = true;
        segStartFrame = Math.max(0, f - 1); // 10ms pre-roll for plosives
        silentStreak = 0;
      }
    } else {
      if (energy < exitThresh) {
        silentStreak++;
        if (silentStreak >= minSilenceFrames) {
          const segEndFrame = f - silentStreak + 1;
          if (segEndFrame - segStartFrame >= minSpeechFrames) {
            rawSegments.push({
              startSec: segStartFrame * 0.01,
              endSec: segEndFrame * 0.01,
            });
          }
          inSpeech = false;
          silentStreak = 0;
        }
      } else {
        silentStreak = 0;
      }
    }
  }

  if (inSpeech) {
    const segEndFrame = Math.max(segStartFrame + minSpeechFrames, rmsFrames.length - silentStreak);
    rawSegments.push({
      startSec: segStartFrame * 0.01,
      endSec: Math.min(samples.length / sampleRate, segEndFrame * 0.01),
    });
  }

  // Merge segments separated by very brief gaps (< 90ms)
  const merged: SpeechSegment[] = [];
  for (const seg of rawSegments) {
    const prev = merged[merged.length - 1];
    if (prev && seg.startSec - prev.endSec < 0.09) {
      prev.endSec = seg.endSec;
    } else {
      merged.push({ ...seg });
    }
  }

  return merged;
}

/**
 * Estimates syllable/articulation weight for Indonesian & English words.
 */
function estimateWordWeight(word: string): { speakWeight: number; tailPauseWeight: number; clauseBreak: boolean } {
  const clean = word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  // Count vowel clusters + numeric digit groups as syllable proxy
  const vowelClusters = clean.match(/[aiueoyAIUEOY]+/g)?.length ?? 0;
  const digitGroups = clean.match(/\d+/g)?.length ?? 0;
  const syllables = Math.max(1, vowelClusters + digitGroups);

  // Subtle base consonant onset + syllable articulation
  const speakWeight = 0.45 + syllables * 0.75;

  const hasStrongBreak = /[.!?;:—–]$/.test(word);
  const hasCommaBreak = /[,:]$/.test(word);
  const tailPauseWeight = hasStrongBreak ? 1.1 : hasCommaBreak ? 0.55 : 0;

  return {
    speakWeight,
    tailPauseWeight,
    clauseBreak: hasStrongBreak || hasCommaBreak,
  };
}

interface TextClause {
  words: string[];
  weights: number[];
  totalWeight: number;
  clauseBreakAtEnd: boolean;
}

function splitIntoClauses(words: string[]): TextClause[] {
  const clauses: TextClause[] = [];
  let currentWords: string[] = [];
  let currentWeights: number[] = [];

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const meta = estimateWordWeight(w);
    currentWords.push(w);
    currentWeights.push(meta.speakWeight);

    const isLast = i === words.length - 1;
    // Break clause on punctuation (if current clause isn't empty)
    if (meta.clauseBreak || isLast) {
      const totalWeight = currentWeights.reduce((a, b) => a + b, 0);
      clauses.push({
        words: currentWords,
        weights: currentWeights,
        totalWeight,
        clauseBreakAtEnd: meta.clauseBreak,
      });
      currentWords = [];
      currentWeights = [];
    }
  }

  return clauses;
}

/**
 * Distributes words proportionally within a contiguous time window [startSec, endSec].
 */
function distributeWordsInRange(
  words: string[],
  weights: number[],
  startSec: number,
  endSec: number,
  fps: number,
  totalDurationInFrames: number,
  clauseBreakLast: boolean
): WordTiming[] {
  const safeSpan = Math.max(0.08, endSec - startSec);
  const totalWeight = weights.reduce((a, b) => a + b, 0) || words.length;
  const result: WordTiming[] = [];

  let cursor = startSec;
  for (let i = 0; i < words.length; i++) {
    const share = (weights[i] / totalWeight) * safeSpan;
    const wStart = cursor;
    const wEnd = i === words.length - 1 ? endSec : cursor + share;
    cursor = wEnd;

    const startFrame = Math.max(0, Math.min(totalDurationInFrames - 1, Math.round(wStart * fps)));
    const endFrame = Math.max(startFrame + 1, Math.min(totalDurationInFrames, Math.round(wEnd * fps)));

    result.push({
      word: words[i],
      startSec: Number(wStart.toFixed(3)),
      endSec: Number(wEnd.toFixed(3)),
      startFrame,
      endFrame,
      clauseBreakAfter: i === words.length - 1 ? clauseBreakLast : estimateWordWeight(words[i]).clauseBreak,
    });
  }

  return result;
}

/**
 * Maps text clauses onto acoustic speech segments using Dynamic Programming (monotonic many-to-many).
 * Handles both merged clauses (1 segment covering 2 clauses) and breath-split clauses (2 segments for 1 clause).
 */
function alignClausesToSegmentsDP(
  clauses: TextClause[],
  segments: SpeechSegment[],
  fps: number,
  totalDurationInFrames: number
): WordTiming[] {
  const C = clauses.length;
  const S = segments.length;

  const totalClauseWeight = clauses.reduce((sum, c) => sum + c.totalWeight, 0) || 1;
  const totalSpeechTime = segments.reduce((sum, s) => sum + (s.endSec - s.startSec), 0) || 1;
  const avgSecPerWeight = totalSpeechTime / totalClauseWeight;

  // dp[i][j] = min cost aligning first i clauses to first j segments
  const INF = 1e12;
  const dp: number[][] = Array.from({ length: C + 1 }, () => Array(S + 1).fill(INF));
  const back: Array<Array<{ prevI: number; prevJ: number } | null>> = Array.from({ length: C + 1 }, () =>
    Array(S + 1).fill(null)
  );

  dp[0][0] = 0;

  for (let i = 1; i <= C; i++) {
    for (let j = 1; j <= S; j++) {
      // Allow grouping up to 3 clauses into 1 segment OR up to 4 segments into 1 clause
      for (let pi = Math.max(0, i - 3); pi < i; pi++) {
        for (let pj = Math.max(0, j - 4); pj < j; pj++) {
          if (dp[pi][pj] >= INF) continue;

          // Only allow both >1 span if one side is 1 (avoid blurry many-to-many jumps)
          if (i - pi > 1 && j - pj > 1) continue;

          let groupWeight = 0;
          for (let k = pi; k < i; k++) groupWeight += clauses[k].totalWeight;

          let groupSpeechSec = 0;
          for (let k = pj; k < j; k++) groupSpeechSec += segments[k].endSec - segments[k].startSec;

          const expectedSec = groupWeight * avgSecPerWeight;
          const ratio = Math.max(expectedSec, 0.05) / Math.max(groupSpeechSec, 0.05);
          const mismatchCost = Math.abs(Math.log(ratio)) * (expectedSec + groupSpeechSec);

          // Small structural penalty for merging/splitting so 1-to-1 is preferred when durations match
          const structurePenalty = (i - pi - 1) * 0.12 + (j - pj - 1) * 0.08;
          const totalCost = dp[pi][pj] + mismatchCost + structurePenalty;

          if (totalCost < dp[i][j]) {
            dp[i][j] = totalCost;
            back[i][j] = { prevI: pi, prevJ: pj };
          }
        }
      }
    }
  }

  // Reconstruct optimal alignment path; fallback to single-span if DP couldn't reach [C][S]
  if (dp[C][S] >= INF) {
    const allWords = clauses.flatMap((c) => c.words);
    const allWeights = clauses.flatMap((c) => c.weights);
    return distributeWordsInRange(
      allWords,
      allWeights,
      segments[0].startSec,
      segments[segments.length - 1].endSec,
      fps,
      totalDurationInFrames,
      true
    );
  }

  const pairs: Array<{ cStart: number; cEnd: number; sStart: number; sEnd: number }> = [];
  let ci = C;
  let sj = S;
  while (ci > 0 && sj > 0) {
    const prev = back[ci][sj];
    if (!prev) break;
    pairs.push({ cStart: prev.prevI, cEnd: ci, sStart: prev.prevJ, sEnd: sj });
    ci = prev.prevI;
    sj = prev.prevJ;
  }
  pairs.reverse();

  const allTimings: WordTiming[] = [];

  for (const p of pairs) {
    const subClauses = clauses.slice(p.cStart, p.cEnd);
    const subSegs = segments.slice(p.sStart, p.sEnd);

    if (subClauses.length === 1 && subSegs.length > 1) {
      // Distribute 1 clause's words sequentially across multiple acoustic segments (e.g. breath pauses)
      const clause = subClauses[0];
      const segDurs = subSegs.map((s) => s.endSec - s.startSec);
      const totalSegDur = segDurs.reduce((a, b) => a + b, 0) || 1;
      const totalClauseW = clause.totalWeight || 1;

      let wordCursor = 0;
      for (let sIdx = 0; sIdx < subSegs.length; sIdx++) {
        const seg = subSegs[sIdx];
        const targetWeight =
          sIdx === subSegs.length - 1
            ? Infinity
            : (segDurs[sIdx] / totalSegDur) * totalClauseW;

        const segWords: string[] = [];
        const segWeights: number[] = [];
        let accW = 0;

        while (wordCursor < clause.words.length) {
          const remainingSegs = subSegs.length - 1 - sIdx;
          const remainingWords = clause.words.length - wordCursor;
          if (sIdx < subSegs.length - 1 && remainingWords <= remainingSegs && segWords.length > 0) {
            break;
          }
          const w = clause.words[wordCursor];
          const wt = clause.weights[wordCursor];
          if (segWords.length > 0 && accW + wt * 0.5 > targetWeight) {
            break;
          }
          segWords.push(w);
          segWeights.push(wt);
          accW += wt;
          wordCursor++;
        }

        if (segWords.length > 0) {
          const isLastSeg = sIdx === subSegs.length - 1;
          allTimings.push(
            ...distributeWordsInRange(
              segWords,
              segWeights,
              seg.startSec,
              seg.endSec,
              fps,
              totalDurationInFrames,
              isLastSeg ? clause.clauseBreakAtEnd : false
            )
          );
        }
      }
    } else {
      // 1-to-1 or multiple clauses within 1 continuous segment (add pause weight at clause breaks!)
      const segStart = subSegs[0].startSec;
      const segEnd = subSegs[subSegs.length - 1].endSec;
      const mergedWords: string[] = [];
      const mergedWeights: number[] = [];

      for (let k = 0; k < subClauses.length; k++) {
        const cl = subClauses[k];
        for (let wIdx = 0; wIdx < cl.words.length; wIdx++) {
          const isClauseEnd = wIdx === cl.words.length - 1 && k < subClauses.length - 1;
          mergedWords.push(cl.words[wIdx]);
          mergedWeights.push(cl.weights[wIdx] + (isClauseEnd ? 0.85 : 0));
        }
      }

      allTimings.push(
        ...distributeWordsInRange(
          mergedWords,
          mergedWeights,
          segStart,
          segEnd,
          fps,
          totalDurationInFrames,
          subClauses[subClauses.length - 1].clauseBreakAtEnd
        )
      );
    }
  }

  return allTimings;
}

/**
 * Fallback syllable- + punctuation-weighted alignment when no WAV waveform or speech bursts exist.
 */
export function alignWordsEstimated(
  spokenText: string,
  durationSeconds: number,
  fps: number = 30
): WordTiming[] {
  const words = spokenText.trim().split(/\s+/).filter(Boolean);
  const totalFrames = Math.max(1, Math.ceil(durationSeconds * fps));
  if (words.length === 0) return [];

  const leadingPad = Math.min(0.25, durationSeconds * 0.04);
  const trailingPad = Math.min(0.3, durationSeconds * 0.05);
  const activeStart = leadingPad;
  const activeEnd = Math.max(activeStart + 0.5, durationSeconds - trailingPad);

  const weights = words.map((w) => {
    const meta = estimateWordWeight(w);
    return meta.speakWeight + meta.tailPauseWeight;
  });

  return distributeWordsInRange(words, weights, activeStart, activeEnd, fps, totalFrames, true);
}

/**
 * Aligns spokenText word-by-word directly against a physical WAV audio file.
 */
export async function alignWordsToWav(
  wavPath: string,
  spokenText: string,
  fps: number = 30
): Promise<AudioAlignmentResult> {
  const buffer = await fs.readFile(wavPath);
  const parsed = parseWavBuffer(buffer);

  const words = spokenText.trim().split(/\s+/).filter(Boolean);
  if (!parsed) {
    const fallbackDur = Math.max(2.5, words.length / 2.3);
    return {
      durationSeconds: fallbackDur,
      speechStartSec: 0.2,
      speechEndSec: fallbackDur - 0.2,
      segments: [],
      wordTimings: alignWordsEstimated(spokenText, fallbackDur, fps),
    };
  }

  const totalDurationInFrames = Math.max(1, Math.ceil(parsed.durationSeconds * fps));
  const segments = detectSpeechSegments(parsed.samples, parsed.sampleRate);

  if (words.length === 0) {
    return {
      durationSeconds: Number(parsed.durationSeconds.toFixed(2)),
      speechStartSec: 0,
      speechEndSec: Number(parsed.durationSeconds.toFixed(2)),
      segments,
      wordTimings: [],
    };
  }

  if (segments.length === 0) {
    const timings = alignWordsEstimated(spokenText, parsed.durationSeconds, fps);
    return {
      durationSeconds: Number(parsed.durationSeconds.toFixed(2)),
      speechStartSec: timings[0]?.startSec ?? 0,
      speechEndSec: timings[timings.length - 1]?.endSec ?? parsed.durationSeconds,
      segments: [],
      wordTimings: timings,
    };
  }

  const clauses = splitIntoClauses(words);
  const wordTimings = alignClausesToSegmentsDP(clauses, segments, fps, totalDurationInFrames);

  return {
    durationSeconds: Number(parsed.durationSeconds.toFixed(2)),
    speechStartSec: Number(segments[0].startSec.toFixed(2)),
    speechEndSec: Number(segments[segments.length - 1].endSec.toFixed(2)),
    segments,
    wordTimings,
  };
}

/**
 * Formats phrase-level landmark cues for Stage 2 Director so visual keyframes
 * trigger right when the narrator speaks key phrases.
 */
export function formatLandmarkCues(wordTimings: WordTiming[]): string {
  if (!wordTimings || wordTimings.length === 0) return 'None';

  const phrases: string[] = [];
  let buf: string[] = [];
  let pStart = wordTimings[0];

  for (let i = 0; i < wordTimings.length; i++) {
    const wt = wordTimings[i];
    if (buf.length === 0) pStart = wt;
    buf.push(wt.word);

    if (wt.clauseBreakAfter || buf.length >= 6 || i === wordTimings.length - 1) {
      phrases.push(
        `[f${pStart.startFrame}-f${wt.endFrame} (${pStart.startSec.toFixed(1)}s-${wt.endSec.toFixed(1)}s)]: "${buf.join(' ')}"`
      );
      buf = [];
    }
  }

  return phrases.join(' | ');
}

