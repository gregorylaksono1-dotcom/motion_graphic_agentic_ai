import 'dotenv/config';
import readline from 'node:readline';
import { StoryToVideoPipeline } from './orchestrator.js';
import { STYLE_PRESETS } from './styles/presets.js';
import { parseTtsMode } from './stages/stage1b-asset-gen/asset-manager.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const askQuestion = (query: string): Promise<string> =>
  new Promise((resolve) => rl.question(query, resolve));

async function runCli() {
  console.log('--- Remotion Story-to-Video Pipeline CLI ---');
  const userStory = await askQuestion('\nEnter your story idea or motion graphic video topic:\n> ');

  if (!userStory.trim()) {
    console.log('Empty story. Cancelled.');
    rl.close();
    return;
  }

  console.log('\nAvailable visual styles:');
  for (const p of Object.values(STYLE_PRESETS)) console.log(`  - ${p.id}: ${p.label}`);
  const styleInput = await askQuestion(
    '\nChoose a style (preset id, free-form description e.g. "retro 80s neon", or Enter = AI auto-pick):\n> '
  );

  const pipeline = new StoryToVideoPipeline({
    outputDir: './output',
    fps: 30,
    // CLI interaktif tidak memuat MCP: 'real' tidak tersedia di sini, default ke dummy agar audio wiring tetap teruji
    ttsMode: process.env.TTS_MODE ? parseTtsMode(process.env.TTS_MODE) : 'dummy',
  });

  try {
    await pipeline.run(userStory, { style: styleInput.trim() || undefined });
  } catch (error: any) {
    console.error('An error occurred:', error.message);
  } finally {
    rl.close();
  }
}

runCli();
