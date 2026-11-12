import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';

/**
 * User-provided assets (--assets <dir>): the ONLY legitimate source for "proof" visuals and specific numbers.
 *
 *   <dir>/dashboard-orders.png   -> screenshots / photos / product images (file name = description)
 *   <dir>/facts.md (or any .md/.txt)  -> ground-truth facts & numbers the script may quote
 */
export interface UserImageAsset {
  key: string; // file name used as key in USER_ASSETS
  description: string; // derived from file name
  sourcePath: string;
  relPath: string; // path inside output/ once copied
}

export interface UserAssetBundle {
  images: UserImageAsset[];
  facts: string;
}

const IMAGE_RE = /\.(png|jpe?g|webp)$/i;

export function scanUserAssets(dir?: string): UserAssetBundle {
  if (!dir) return { images: [], facts: '' };
  const abs = path.resolve(process.cwd(), dir);
  if (!fsSync.existsSync(abs)) throw new Error(`--assets folder not found: ${abs}`);
  const files = fsSync.readdirSync(abs).sort();
  const images = files
    .filter((f) => IMAGE_RE.test(f))
    .map((f) => {
      const key = f.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
      return {
        key,
        description: path.parse(f).name.replace(/[-_]+/g, ' ').trim(),
        sourcePath: path.join(abs, f),
        relPath: `assets/user/${key}`,
      };
    });
  const facts = files
    .filter((f) => /\.(md|txt)$/i.test(f))
    .map((f) => fsSync.readFileSync(path.join(abs, f), 'utf-8').trim())
    .join('\n\n')
    .slice(0, 6000);
  console.log(`📎 [User Assets] ${images.length} image(s), ${facts ? facts.length + ' fact characters' : 'no facts file'} from ${abs}`);
  return { images, facts };
}

export async function copyUserAssets(bundle: UserAssetBundle, outputDir: string): Promise<void> {
  if (bundle.images.length === 0) return;
  const target = path.join(outputDir, 'assets', 'user');
  await fs.mkdir(target, { recursive: true });
  for (const img of bundle.images) await fs.copyFile(img.sourcePath, path.join(outputDir, img.relPath));
}

/** Prompt block for Stage 1/2/3 */
export function describeUserAssetsForPrompt(bundle: UserAssetBundle): string {
  const lines: string[] = [];
  if (bundle.images.length > 0) {
    lines.push('User-provided images (real, may be shown as proof; reference by key):');
    for (const img of bundle.images) lines.push(`- USER_ASSETS['${img.key}'] — ${img.description}`);
  } else {
    lines.push('User-provided images: none.');
  }
  lines.push(
    bundle.facts
      ? `User-provided facts (the ONLY allowed source of specific numbers, IPs, dates, names presented as real):\n"""\n${bundle.facts}\n"""`
      : 'User-provided facts: none. Do NOT present invented specific numbers, logs, IPs or dates as real proof; use general, well-known facts or clearly illustrative examples.'
  );
  return lines.join('\n');
}
