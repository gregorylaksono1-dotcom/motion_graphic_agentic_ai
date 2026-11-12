import { StyleAnalystAgent } from './stages/stage0-style/agent.js';
import { ScriptwriterAgent } from './stages/stage1-scriptwriter/agent.js';
import { AssetGenerationManager, type TtsMode } from './stages/stage1b-asset-gen/asset-manager.js';
import { bridgeStoryboardTiming } from './stages/bridge/timing.js';
import { MotionDirectorAgent } from './stages/stage2-director/agent.js';
import { RemotionCoderService } from './stages/stage3-coder/service.js';
import { costTracker } from './core/cost-tracker.js';
import type { ModelConfig } from './llm/provider.js';
import type { DirectorBlueprint } from './types/director.js';
import type { AssetManifest } from './types/asset.js';
import type { StructuredTool } from '@langchain/core/tools';
import type { StyleProfile } from './styles/presets.js';
import { loadAvatarPack } from './avatar/avatar-pack.js';
import { scanUserAssets, copyUserAssets, describeUserAssetsForPrompt } from './assets/user-assets.js';
import path from 'node:path';
import fs from 'node:fs';
import type { BrandKit } from './styles/genome.js';

export interface PipelineOptions {
  modelConfig?: ModelConfig;
  outputDir?: string;
  fps?: number;
  mcpTools?: StructuredTool[];
  maxRepairCycles?: number;
  /** 'real' (Gemini TTS, paid) | 'dummy' (silent wav, free) | 'skip' (no audio, free) */
  ttsMode?: TtsMode;
}

export interface RunOptions {
  /** Preset id (e.g. "neon-tech"), free-form style text (e.g. "retro 80s synthwave"), or empty/"auto" for LLM auto-pick */
  style?: string;
  /** Avatar pack id in library/avatar/<id> (talking presenter), e.g. "my-presenter" */
  avatar?: string;
  /** Social handle shown in the brand pill, e.g. "@yourhandle" */
  handle?: string;
  /** Folder with user-provided screenshots/images and facts.md */
  assetsDir?: string;
  /** Creative seed for the Style Genome (reproducible looks) */
  seed?: number;
  /** Brand kit JSON (locked palette/fonts/handle) */
  brandFile?: string;
}

export class StoryToVideoPipeline {
  private styleAnalyst: StyleAnalystAgent;
  private scriptwriter: ScriptwriterAgent;
  private assetManager: AssetGenerationManager;
  private director: MotionDirectorAgent;
  private coderService: RemotionCoderService;
  private fps: number;
  private outputDir: string;
  private mcpTools: StructuredTool[];

  constructor(options?: PipelineOptions) {
    const outputDir = options?.outputDir || './output';
    this.styleAnalyst = new StyleAnalystAgent(options?.modelConfig);
    this.scriptwriter = new ScriptwriterAgent(options?.modelConfig);
    this.assetManager = new AssetGenerationManager(outputDir, { ttsMode: options?.ttsMode });
    this.director = new MotionDirectorAgent(options?.modelConfig);
    this.coderService = new RemotionCoderService({
      modelConfig: options?.modelConfig,
      outputDir,
      maxRepairCycles: options?.maxRepairCycles ?? 3,
    });
    this.fps = options?.fps || 30;
    this.outputDir = outputDir;
    this.mcpTools = options?.mcpTools || [];
  }

  /**
   * Menjalankan seluruh pipeline secara high-level dan bersih:
   * Stage 1 (Story) -> Stage 1b (Assets) -> Bridge (Timing) -> Stage 2 (Director) -> Stage 3 (Build & Verify)
   */
  async run(userStory: string, runOptions: RunOptions = {}): Promise<{
    style: StyleProfile;
    blueprint: DirectorBlueprint;
    assetManifest: AssetManifest;
    writtenFiles: string[];
    entryPath: string;
    compileSuccess: boolean;
  }> {
    console.log('========================================================================');
    console.log('🎬 Starting Modular Pipeline: Story ➡️ Assets ➡️ Director ➡️ Build & Verify');
    console.log('========================================================================\n');

    costTracker.reset();

    try {
      // Inputs: avatar pack (fail fast) + user assets (ground truth for "proof")
      const avatar = runOptions.avatar ? loadAvatarPack(runOptions.avatar) : null;
      const userAssets = scanUserAssets(runOptions.assetsDir);
      const userAssetsBrief = describeUserAssetsForPrompt(userAssets);

      // TAHAP 0: Art Director — preset, or a freshly designed Style Genome (brand locks + anti-repetition)
      const brandKit: BrandKit = runOptions.brandFile ? JSON.parse(fs.readFileSync(path.resolve(runOptions.brandFile), 'utf-8')) : {};
      const style = await this.styleAnalyst.resolveStyle(userStory, runOptions.style, { seed: runOptions.seed, brandKit });

      // TAHAP 1: Scriptwriter (LLM 1)
      const storyboard = await this.scriptwriter.generateStoryboard(userStory, style, userAssetsBrief);
      console.log(
        `\n📋 [Storyboard Complete] Title: "${storyboard.title}" | Style: ${storyboard.visualStyle} | Total Scenes: ${storyboard.scenes.length}`
      );

      // TAHAP 1b: Asset & Resource Generation (Gemini TTS MCP, Polygons, Icons)
      const assetManifest = await this.assetManager.generateAssets(
        storyboard,
        this.mcpTools,
        this.fps
      );

      // THE BRIDGE: Audio Timing & Frame Boundary Calculation
      await copyUserAssets(userAssets, path.resolve(process.cwd(), this.outputDir));
      const timedStoryboard = bridgeStoryboardTiming(storyboard, this.fps, assetManifest, style.pacing.beatIntervalSec);

      // TAHAP 2: Motion Director (LLM 2)
      const blueprint = await this.director.choreographTimeline(timedStoryboard, style, { avatar, userAssetsBrief });
      console.log(
        `\n📐 [Blueprint Complete] Total Frames: ${blueprint.totalDurationInFrames} (~${(blueprint.totalDurationInFrames / this.fps).toFixed(1)}s)`
      );

      // TAHAP 3: Remotion Code Engineer (One-Caller: Generate + Compile Check + Self-Repair)
      const buildResult = await this.coderService.buildAndVerifyProject(
        blueprint,
        storyboard.synopsis,
        assetManifest,
        style,
        {
          brand: { chapterLabel: storyboard.chapterLabel, cornerLabel: storyboard.cornerLabel, handle: runOptions.handle || brandKit.handle || process.env.BRAND_HANDLE || '' },
          avatar,
          userAssets,
        }
      );

      console.log('\n🎉 [Done] Entire pipeline executed successfully!');
      console.log(`- Entrypoint:  ${buildResult.entryPath}`);
      console.log(`- Total Files: ${buildResult.writtenFiles.length + 5} project files + ${assetManifest.audioTracks.length} audio file(s)`);
      console.log(`- Compilation: ${buildResult.compileSuccess ? '✅ Valid (0 errors)' : '⚠️ Still has errors'} (Repair cycles: ${buildResult.repairCyclesUsed})`);
      console.log(`\n▶️ Run 'npm run preview' to play the video in the browser.`);
      console.log(`▶️ Run 'npm run render' to render the video to MP4.`);

      return {
        style,
        blueprint,
        assetManifest,
        writtenFiles: buildResult.writtenFiles,
        entryPath: buildResult.entryPath,
        compileSuccess: buildResult.compileSuccess,
      };
    } finally {
      costTracker.printSummary();
    }
  }
}
