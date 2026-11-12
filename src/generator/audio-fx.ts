import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import type { StyleProfile } from '../styles/presets.js';

export const SFX_LIBRARY_IDS = ['whoosh', 'pop', 'click', 'impact', 'riser', 'ding', 'swoosh-soft'] as const;
export type SfxLibraryId = (typeof SFX_LIBRARY_IDS)[number];

const SR = 44100;

/** Deterministic PRNG so the synthesized SFX are identical on every run */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function encodeWav(samples: Float32Array, sampleRate = SR): Buffer {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  return buf;
}

function normalize(samples: Float32Array, peak = 0.85): Float32Array {
  let max = 0;
  for (const s of samples) max = Math.max(max, Math.abs(s));
  if (max === 0) return samples;
  const g = peak / max;
  for (let i = 0; i < samples.length; i++) samples[i] *= g;
  return samples;
}

/** Noise through a swept one-pole low-pass + high-pass -> airy whoosh */
function synthWhoosh(durSec: number, seed: number, brightness = 1): Float32Array {
  const rnd = mulberry32(seed);
  const n = Math.floor(durSec * SR);
  const out = new Float32Array(n);
  let lp = 0;
  let hpPrev = 0;
  let hpOut = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const env = t < 0.45 ? Math.pow(t / 0.45, 2) : Math.pow(1 - (t - 0.45) / 0.55, 1.6);
    const cutoff = (300 + 4200 * brightness * Math.sin(Math.PI * Math.min(1, t * 1.1))) / SR;
    const a = 1 - Math.exp(-2 * Math.PI * cutoff);
    lp += a * ((rnd() * 2 - 1) - lp);
    hpOut = 0.97 * (hpOut + lp - hpPrev);
    hpPrev = lp;
    out[i] = hpOut * env;
  }
  return normalize(out, 0.8);
}

function synthPop(): Float32Array {
  const n = Math.floor(0.14 * SR);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const freq = 260 + 900 * Math.exp(-t * 55);
    phase += (2 * Math.PI * freq) / SR;
    const env = Math.min(1, t * 900) * Math.exp(-t * 32);
    out[i] = Math.sin(phase) * env;
  }
  return normalize(out, 0.85);
}

function synthClick(seed: number): Float32Array {
  const rnd = mulberry32(seed);
  const n = Math.floor(0.05 * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const noise = (rnd() * 2 - 1) * Math.exp(-t * 900);
    const tone = Math.sin(2 * Math.PI * 2100 * t) * Math.exp(-t * 160) * 0.6;
    out[i] = noise * 0.7 + tone;
  }
  return normalize(out, 0.7);
}

function synthImpact(seed: number): Float32Array {
  const rnd = mulberry32(seed);
  const n = Math.floor(0.6 * SR);
  const out = new Float32Array(n);
  let phase = 0;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const freq = 42 + 110 * Math.exp(-t * 14);
    phase += (2 * Math.PI * freq) / SR;
    const body = Math.sin(phase) * Math.exp(-t * 6.5);
    lp += 0.18 * ((rnd() * 2 - 1) - lp);
    const crack = lp * Math.exp(-t * 38) * 1.4;
    out[i] = Math.tanh((body + crack) * 1.6);
  }
  return normalize(out, 0.9);
}

function synthRiser(seed: number): Float32Array {
  const rnd = mulberry32(seed);
  const n = Math.floor(0.9 * SR);
  const out = new Float32Array(n);
  let phase = 0;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const freq = 180 + 1400 * t * t;
    phase += (2 * Math.PI * freq) / SR;
    const saw = ((phase / Math.PI) % 2) - 1;
    lp += (0.02 + 0.3 * t) * ((rnd() * 2 - 1) - lp);
    const env = Math.pow(t, 1.8) * (t > 0.95 ? (1 - t) / 0.05 : 1);
    out[i] = (saw * 0.25 + lp * 0.9) * env;
  }
  return normalize(out, 0.7);
}

function synthDing(): Float32Array {
  const n = Math.floor(0.7 * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.min(1, t * 600) * Math.exp(-t * 6);
    out[i] =
      (Math.sin(2 * Math.PI * 1318.5 * t) + 0.45 * Math.sin(2 * Math.PI * 2637 * t) + 0.2 * Math.sin(2 * Math.PI * 3955 * t)) * env;
  }
  return normalize(out, 0.6);
}

function synthesize(id: SfxLibraryId): Float32Array {
  switch (id) {
    case 'whoosh':
      return synthWhoosh(0.42, 11, 1);
    case 'swoosh-soft':
      return synthWhoosh(0.3, 23, 0.55);
    case 'pop':
      return synthPop();
    case 'click':
      return synthClick(7);
    case 'impact':
      return synthImpact(5);
    case 'riser':
      return synthRiser(3);
    case 'ding':
      return synthDing();
  }
}

/**
 * Writes all SFX into `<output>/assets/sfx/<id>.wav`.
 * If `library/sfx/<id>.wav` exists in the project root (your own licensed SFX), it is copied instead of synthesized.
 */
export async function writeSfxAssets(outputDir: string, libraryDir = path.resolve(process.cwd(), 'library')): Promise<SfxLibraryId[]> {
  const sfxDir = path.join(outputDir, 'assets', 'sfx');
  await fs.mkdir(sfxDir, { recursive: true });
  let fromLibrary = 0;

  for (const id of SFX_LIBRARY_IDS) {
    const target = path.join(sfxDir, `${id}.wav`);
    const custom = path.join(libraryDir, 'sfx', `${id}.wav`);
    if (fsSync.existsSync(custom)) {
      await fs.copyFile(custom, target);
      fromLibrary++;
    } else {
      await fs.writeFile(target, encodeWav(synthesize(id)));
    }
  }

  console.log(
    `[AudioFX] 🔊 SFX ready: ${SFX_LIBRARY_IDS.length} files (${fromLibrary} from library/sfx, ${SFX_LIBRARY_IDS.length - fromLibrary} synthesized)`
  );
  return [...SFX_LIBRARY_IDS];
}

/**
 * Picks a background music track for the style's mood from `library/music/<mood>/` (falls back to `library/music/`).
 * Copies it to `<output>/assets/music/` and returns the file name, or undefined when no library exists.
 */
export async function prepareMusicBed(
  outputDir: string,
  style: StyleProfile,
  libraryDir = path.resolve(process.cwd(), 'library')
): Promise<string | undefined> {
  const candidatesDirs = [path.join(libraryDir, 'music', style.musicMood), path.join(libraryDir, 'music')];
  for (const dir of candidatesDirs) {
    if (!fsSync.existsSync(dir)) continue;
    const files = (await fs.readdir(dir)).filter((f) => /\.(mp3|wav|m4a|aac)$/i.test(f)).sort();
    if (files.length === 0) continue;
    // Deterministic but varied pick per project title
    const seed = [...style.id, ...style.musicMood].reduce((a, c) => a + c.charCodeAt(0), Date.now() % 997);
    const pick = files[seed % files.length];
    const ext = path.extname(pick).toLowerCase();
    const targetName = `bed${ext}`;
    const targetDir = path.join(outputDir, 'assets', 'music');
    await fs.mkdir(targetDir, { recursive: true });
    for (const old of fsSync.existsSync(targetDir) ? await fs.readdir(targetDir) : []) {
      if (old.startsWith('bed.')) await fs.rm(path.join(targetDir, old), { force: true });
    }
    await fs.copyFile(path.join(dir, pick), path.join(targetDir, targetName));
    console.log(`[AudioFX] 🎵 Music bed (${style.musicMood}): ${path.relative(process.cwd(), path.join(dir, pick))}`);
    return targetName;
  }
  console.log(
    `[AudioFX] ℹ️ No music found in library/music/${style.musicMood}/ — rendering video without music bed (place an .mp3 file there to enable).`
  );
  return undefined;
}

/** Writes a silent mono WAV of the given duration (used by --tts=dummy) */
export async function writeSilentWav(filePath: string, durationSec: number, sampleRate = 24000): Promise<number> {
  const samples = new Float32Array(Math.max(1, Math.round(durationSec * sampleRate)));
  const buf = encodeWav(samples, sampleRate);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buf);
  return buf.length;
}
