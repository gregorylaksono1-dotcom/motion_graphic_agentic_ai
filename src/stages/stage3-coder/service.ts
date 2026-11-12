import { RemotionCoderAgent } from './agent.js';
import { runProjectCompileCheck } from './compiler.js';
import { RemotionProjectWriter } from '../../generator/writer.js';
import type { ModelConfig } from '../../llm/provider.js';
import type { DirectorBlueprint } from '../../types/director.js';
import type { AssetManifest } from '../../types/asset.js';
import type { StyleProfile } from '../../styles/presets.js';
import type { AvatarPack } from '../../avatar/avatar-pack.js';
import { describeUserAssetsForPrompt, type UserAssetBundle } from '../../assets/user-assets.js';

export interface Stage3Extras {
  brand: { chapterLabel: string; cornerLabel: string; handle: string };
  avatar: AvatarPack | null;
  userAssets: UserAssetBundle;
}

export interface Stage3BuildResult {
  writtenFiles: string[];
  entryPath: string;
  compileSuccess: boolean;
  repairCyclesUsed: number;
  remainingErrors: Record<string, string[]>;
}

/**
 * Facade for Stage 3:
 * Encapsulates component code generation, disk writing, project-wide `tsc` verification,
 * and per-file targeted self-repair loop behind a single clean caller.
 */
export class RemotionCoderService {
  private agent: RemotionCoderAgent;
  private writer: RemotionProjectWriter;
  private maxRepairCycles: number;

  constructor(options?: {
    modelConfig?: ModelConfig;
    outputDir?: string;
    maxRepairCycles?: number;
  }) {
    this.agent = new RemotionCoderAgent(options?.modelConfig);
    this.writer = new RemotionProjectWriter(options?.outputDir || './output');
    this.maxRepairCycles = options?.maxRepairCycles ?? 3;
  }

  /**
   * One-Caller entrypoint for Stage 3:
   * Generates all modular Remotion files, verifies compilation across the whole project,
   * and repairs only broken files per-file until compilation passes or max cycles reached.
   */
  async buildAndVerifyProject(
    blueprint: DirectorBlueprint,
    synopsis: string = '',
    assetManifest: AssetManifest | undefined,
    style: StyleProfile,
    extras: Stage3Extras = { brand: { chapterLabel: '', cornerLabel: 'LIVE', handle: '' }, avatar: null, userAssets: { images: [], facts: '' } }
  ): Promise<Stage3BuildResult> {
    console.log('\n🔨 [Stage 3: Remotion Code Engineer] Modular Project Generation & Verification...');

    // 1. Bersihkan komponen lama & tulis file kontrak bersama (types.ts, constants/theme.ts, constants/wordTimings.ts) + KineticCaptions + SceneCraft
    await this.writer.cleanComponentsDir();
    await this.writer.writeContractFiles(blueprint);
    const wordTimingsPath = await this.writer.writeWordTimingsFile(blueprint, assetManifest);
    const captionsPath = await this.writer.writeKineticCaptionsComponent();
    const sceneCraftPath = await this.writer.writeSceneCraftComponent();
    const beatsPath = await this.writer.writeBeatsFile(blueprint, style);
    const { beatFxPath } = await this.writer.writeBeatFxLayer(style);
    const headlinePath = await this.writer.writeHeadlineCaptionsComponent();
    const userAssetsPath = await this.writer.writeUserAssetsFile(extras.userAssets);
    const presenterPaths = await this.writer.writePresenterLayer(
      blueprint,
      { ...extras.brand, enabled: style.layoutMode === 'evidence' },
      extras.avatar,
      assetManifest
    );

    const writtenFiles: string[] = [wordTimingsPath, captionsPath, sceneCraftPath, beatsPath, beatFxPath, headlinePath, userAssetsPath, ...presenterPaths];
    const layoutCtx = { avatar: !!extras.avatar, userAssetsBrief: describeUserAssetsForPrompt(extras.userAssets) };

    // 2. Generate & tulis Background (pastikan path sesuai blueprint)
    const bgResult = await this.agent.generateBackgroundComponent(blueprint, style);
    const bgPath = blueprint.backgroundComponent.filePath;
    await this.writer.writeComponentFile({ ...bgResult, filePath: bgPath });
    writtenFiles.push(bgPath);

    // 3. Generate & tulis tiap Scene (pastikan path sesuai blueprint)
    for (const scene of blueprint.scenes) {
      const audioTrack = assetManifest?.audioTracks.find((a) => a.sceneNumber === scene.sceneNumber);
      const sceneResult = await this.agent.generateSceneComponent(scene, blueprint, audioTrack, style, layoutCtx);
      await this.writer.writeComponentFile({ ...sceneResult, filePath: scene.filePath });
      writtenFiles.push(scene.filePath);
    }

    // 4. Generate & tulis Master Composition (lengkap dengan audio voiceover jika tersedia)
    const mainCompResult = this.agent.generateMainComposition(blueprint, assetManifest, {
      captionMode: style.captionMode,
      avatar: !!extras.avatar,
      brandFrame: style.layoutMode === 'evidence' || !!extras.brand.handle,
      genome: style.genome,
    });
    await this.writer.writeComponentFile(mainCompResult);
    writtenFiles.push(mainCompResult.filePath);

    // 5. Finalisasi Root.tsx, index.ts, tsconfig.json, metadata.json
    const finalized = await this.writer.finalizeProject(blueprint, synopsis, style);

    // 6. Project-Wide Compile Check + Per-File Targeted Repair Cycle
    const { compileSuccess, repairCyclesUsed, remainingErrors } = await this.verifyAndRepairLoop(blueprint);

    return {
      writtenFiles,
      entryPath: finalized.indexPath,
      compileSuccess,
      repairCyclesUsed,
      remainingErrors,
    };
  }

  /**
   * Internal Cycle:
   * 1) Compile whole `output/` with `tsc --noEmit`
   * 2) Group errors per file
   * 3) Send each broken file individually to LLM Stage 3 for targeted repair
   * 4) Re-compile until 0 errors or maxRepairCycles reached
   */
  private async verifyAndRepairLoop(blueprint: DirectorBlueprint): Promise<{
    compileSuccess: boolean;
    repairCyclesUsed: number;
    remainingErrors: Record<string, string[]>;
  }> {
    const outputDir = this.writer.getBaseDir();
    let repairCyclesUsed = 0;

    for (let cycle = 0; cycle <= this.maxRepairCycles; cycle++) {
      console.log(
        cycle === 0
          ? `\n🧪 [Verifier] Running TypeScript compilation test (project-wide)...`
          : `\n🔄 [Verifier] Re-compiling after repair (Cycle ${cycle}/${this.maxRepairCycles})...`
      );

      const check = await runProjectCompileCheck(outputDir);

      if (check.success) {
        console.log(`✅ [Verifier] Compilation passed 100% (0 errors)!`);
        return {
          compileSuccess: true,
          repairCyclesUsed,
          remainingErrors: {},
        };
      }

      const brokenFiles = Object.entries(check.errorsByFile);
      console.warn(
        `⚠️ [Verifier] Found errors in ${brokenFiles.length} file(s).`
      );

      if (cycle === this.maxRepairCycles || brokenFiles.length === 0) {
        if (check.generalErrors.length > 0) {
          console.error(`❌ [Verifier] General compiler errors:\n${check.generalErrors.join('\n')}`);
        }
        for (const [filePath, errs] of brokenFiles) {
          console.error(`❌ [Verifier] Remaining errors in ${filePath}:\n  - ${errs.join('\n  - ')}`);
        }
        return {
          compileSuccess: false,
          repairCyclesUsed,
          remainingErrors: check.errorsByFile,
        };
      }

      // Per-file targeted repair (1 file = 1 LLM hit)
      repairCyclesUsed++;
      for (const [filePath, fileErrors] of brokenFiles) {
        // Skip auto-generated entry files if somehow flagged, or repair component files
        try {
          const currentCode = await this.writer.readComponentFile(filePath);
          const repaired = await this.agent.repairFileComponent(filePath, currentCode, fileErrors, blueprint);
          await this.writer.writeComponentFile({
            ...repaired,
            filePath, // Ensure path stays consistent with original file
          });
        } catch (err: any) {
          console.error(`  ❌ Failed to repair ${filePath}: ${err.message}`);
        }
      }
    }

    return {
      compileSuccess: false,
      repairCyclesUsed,
      remainingErrors: {},
    };
  }
}

