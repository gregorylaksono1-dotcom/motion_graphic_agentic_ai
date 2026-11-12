import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';

export interface AvatarPose {
  id: string;
  file: string;
  hint: string;
  mouth: { x: number; y: number; width: number; rotate?: number };
  contentBox: { x0: number; y0: number; x1: number; y1: number };
}

export interface AvatarPack {
  id: string;
  dir: string;
  canvas: { width: number; height: number };
  defaultPose: string;
  poses: AvatarPose[];
  mouths: Record<string, { file: string; w: number; h: number }>;
  mouthReferenceWidth: number;
  visemeMap: Record<string, string>;
}

/** Loads library/avatar/<id>/avatar.json (created by tools/avatar_prepare.py) */
export function loadAvatarPack(id: string, libraryDir = path.resolve(process.cwd(), 'library', 'avatar')): AvatarPack {
  const dir = path.join(libraryDir, id);
  const manifestPath = path.join(dir, 'avatar.json');
  if (!fsSync.existsSync(manifestPath)) {
    const available = fsSync.existsSync(libraryDir) ? fsSync.readdirSync(libraryDir).join(', ') : '(none)';
    throw new Error(`Avatar pack "${id}" not found at ${manifestPath}. Available: ${available}. Create one with: python3 tools/avatar_prepare.py --src <folder> --id ${id}`);
  }
  const manifest = JSON.parse(fsSync.readFileSync(manifestPath, 'utf-8'));
  return { ...manifest, dir };
}

/** Copies pose & mouth PNGs into <output>/assets/avatar/<id>/ and returns paths relative to the output root */
export async function copyAvatarAssets(pack: AvatarPack, outputDir: string): Promise<{ poses: Record<string, string>; mouths: Record<string, string> }> {
  const target = path.join(outputDir, 'assets', 'avatar', pack.id);
  await fs.mkdir(path.join(target, 'poses'), { recursive: true });
  await fs.mkdir(path.join(target, 'mouths'), { recursive: true });
  const poses: Record<string, string> = {};
  const mouths: Record<string, string> = {};
  for (const p of pack.poses) {
    await fs.copyFile(path.join(pack.dir, p.file), path.join(target, p.file));
    poses[p.id] = `assets/avatar/${pack.id}/${p.file}`;
  }
  for (const [name, m] of Object.entries(pack.mouths)) {
    await fs.copyFile(path.join(pack.dir, m.file), path.join(target, m.file));
    mouths[name] = `assets/avatar/${pack.id}/${m.file}`;
  }
  return { poses, mouths };
}

export function describePosesForPrompt(pack: AvatarPack): string {
  return pack.poses.map((p) => `- "${p.id}": ${p.hint}`).join('\n');
}
