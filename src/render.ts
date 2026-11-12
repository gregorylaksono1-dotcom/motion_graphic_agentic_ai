import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

async function runRender() {
  const metaPath = path.resolve(process.cwd(), 'output/metadata.json');

  let compositionId = 'CyberpunkIntro';

  try {
    const metaContent = await fs.readFile(metaPath, 'utf-8');
    const meta = JSON.parse(metaContent);
    compositionId = meta.mainCompositionName || meta.componentName || compositionId;
    console.log(`🎬 Detected Composition: "${compositionId}" from output/metadata.json`);
  } catch (err) {
    console.log(`ℹ️ metadata.json not found or invalid, using default composition: "${compositionId}"`);
  }

  const outputPath = path.resolve(process.cwd(), 'output/video.mp4');
  const entryPath = path.resolve(process.cwd(), 'output/index.ts');

  console.log(`🚀 Starting Remotion render for [${compositionId}] -> ${outputPath}...\n`);

  const remotionArgs = [
    'remotion',
    'render',
    entryPath,
    compositionId,
    outputPath,
  ];

  const child = spawn('npx', remotionArgs, {
    stdio: 'inherit',
    shell: true,
  });

  child.on('close', (code) => {
    if (code === 0) {
      console.log(`\n🎉 Rendering successful! Video saved to: ${outputPath}`);
    } else {
      console.error(`\n❌ Remotion render exited with code: ${code}`);
      process.exit(code || 1);
    }
  });
}

runRender().catch(console.error);

