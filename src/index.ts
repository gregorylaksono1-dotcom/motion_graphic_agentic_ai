import 'dotenv/config';
import path from 'node:path';
import { StoryToVideoPipeline } from './orchestrator.js';
import { LangChainMCPManager } from './mcp/client.js';
import { describeStageLlm } from './llm/factory.js';
import { STYLE_PRESETS } from './styles/presets.js';
import { parseTtsMode, type TtsMode } from './stages/stage1b-asset-gen/asset-manager.js';

async function main() {

  const rawArgs = process.argv.slice(2);

  if (rawArgs.includes('--list-styles')) {
    console.log('Available style presets (use --style=<id>, free text, or omit for auto-pick):\n');
    for (const p of Object.values(STYLE_PRESETS)) {
      console.log(`  ${p.id.padEnd(18)} ${p.label}\n  ${''.padEnd(18)} ${p.description}\n`);
    }
    return;
  }

  const disableTools = rawArgs.includes('--no-tools') || rawArgs.includes('--no-mcp');
  // --style=neon-tech | --style "retro 80s synthwave" | (omitted) -> auto-pick
  let style: string | undefined;
  // --tts=real|dummy|skip  (aliases: --dummy-tts, --skip-tts; env TTS_MODE)
  let ttsMode: TtsMode = parseTtsMode(process.env.TTS_MODE);
  const storyArgs: string[] = [];
  const extra: { avatar?: string; handle?: string; assets?: string; brand?: string; seed?: string } = {
    avatar: process.env.AVATAR_ID || undefined,
    handle: process.env.BRAND_HANDLE || undefined,
  };
  for (let i = 0; i < rawArgs.length; i++) {
    const a = rawArgs[i];
    if (a === '--no-tools' || a === '--no-mcp') continue;
    if (a.startsWith('--tts=')) {
      ttsMode = parseTtsMode(a.slice('--tts='.length));
      continue;
    }
    const kv = a.match(/^--(avatar|handle|assets|brand|seed)=(.*)$/);
    if (kv) {
      extra[kv[1] as keyof typeof extra] = kv[2];
      continue;
    }
    if (['--avatar', '--handle', '--assets', '--brand', '--seed'].includes(a)) {
      extra[a.slice(2) as keyof typeof extra] = rawArgs[++i];
      continue;
    }
    if (a === '--dummy-tts') {
      ttsMode = 'dummy';
      continue;
    }
    if (a === '--skip-tts') {
      ttsMode = 'skip';
      continue;
    }
    if (a.startsWith('--style=')) {
      style = a.slice('--style='.length);
      continue;
    }
    if (a === '--style') {
      style = rawArgs[++i];
      continue;
    }
    storyArgs.push(a);
  }

  console.log('========================================================================');
  console.log('🚀 Autonomous Motion Graphic Generator (Stage 1 -> 1b -> 2 -> 3)');
  console.log(`Stage 0 (Art Director): ${describeStageLlm('stage0-style-analyst')}`);
  console.log(`Stage 1 (Scriptwriter): ${describeStageLlm('stage1-scriptwriter')}`);
  console.log(`Stage 2 (Director):     ${describeStageLlm('stage2-director')}`);
  console.log(`Stage 3 (Coder):        ${describeStageLlm('stage3-coder')}`);
  console.log(`MCP Tools Mode:         ${disableTools ? 'DISABLED (--no-tools)' : 'ENABLED'}`);
  console.log(`Style:                  ${style ? style : 'AUTO (Style Genome designed by LLM)'}${extra.seed ? ` | seed ${extra.seed}` : ''}${extra.brand ? ` | brand ${extra.brand}` : ''}`);
  console.log(`Avatar / Handle:        ${extra.avatar || '-'} / ${extra.handle || '-'}${extra.assets ? ` | assets: ${extra.assets}` : ''}`);
  console.log(`TTS Mode:               ${ttsMode}${ttsMode === 'real' ? ' (Gemini TTS, paid)' : ' (free, for testing)'}`);
  console.log('========================================================================\n');

  // 1. Initialize MCP Manager unless --no-tools is set
  const mcp = new LangChainMCPManager();

  if (!disableTools) {
    // Motion design tokens server
    mcp.addStdioServer({
      name: 'motion_design',
      command: 'node',
      args: [path.resolve(process.cwd(), 'dist/mcp/sample-server.js')],
    });

    // Gemini TTS audio generation server (only when real TTS is requested)
    if (ttsMode === 'real') mcp.addStdioServer({
      name: 'gemini_tts',
      command: 'node',
      args: [path.resolve(process.cwd(), 'dist/mcp/gemini-tts-server.js')],
    });
  }

  try {
    // Load tools from all registered MCP servers (empty array if --no-tools)
    const mcpTools = disableTools ? [] : await mcp.getTools();

    // Default sample story from user or custom CLI input
    const userStory =
      storyArgs.join(' ') ||
      'Ceritakan tentang revolusi kecerdasan buatan: dari era kode manual yang lambat dan penuh bug, hingga lahirnya Agentic AI yang mampu merancang arsitektur software dan video animasi secara otomatis dalam hitungan detik.';

    console.log(`📖 User Story Input:\n"${userStory}"\n`);

    const pipeline = new StoryToVideoPipeline({
      outputDir: './output',
      fps: 30,
      mcpTools,
      ttsMode,
    });

    await pipeline.run(userStory, {
      style,
      avatar: extra.avatar,
      handle: extra.handle,
      assetsDir: extra.assets,
      brandFile: extra.brand || process.env.BRAND_KIT || undefined,
      seed: extra.seed ? Number(extra.seed) : undefined,
    });
  } catch (err: any) {
    console.error('\n❌ An error occurred during pipeline execution:');
    if (
      err.message?.includes('API key') ||
      err.message?.includes('OPENAI_API_KEY') ||
      err.message?.includes('ANTHROPIC_API_KEY')
    ) {
      console.error('API key is not set! Please copy .env.example to .env and fill in your API key.');
      console.error('Supported providers: OpenAI, Anthropic, Google Gemini, Ollama (local), or OpenRouter.');
    } else {
      console.error(err.message || err);
    }
  } finally {
    await mcp.close();
  }
}

main().catch(console.error);
