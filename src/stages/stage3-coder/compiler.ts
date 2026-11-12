import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);

export interface CompileCheckResult {
  success: boolean;
  errorsByFile: Record<string, string[]>;
  generalErrors: string[];
  rawOutput: string;
}

/**
 * Checks generated scene TSX files for common Remotion runtime bugs that `tsc` does not catch,
 * such as `interpolate(frame, [a, b], [x, y, z])` array length mismatches or non-increasing inputRange.
 */
async function checkRemotionRuntimeSafety(outputDir: string): Promise<Record<string, string[]>> {
  const errorsByFile: Record<string, string[]> = {};
  const scenesDir = path.join(outputDir, 'components', 'scenes');

  let files: string[] = [];
  try {
    files = await fs.readdir(scenesDir);
  } catch {
    return errorsByFile;
  }

  const interpRegex = /interpolate\s*\([^,]+,\s*\[([^\]]+)\]\s*,\s*\[([^\]]+)\]/g;

  for (const file of files) {
    if (!file.endsWith('.tsx') && !file.endsWith('.ts')) continue;
    const relPath = `components/scenes/${file}`;
    const content = await fs.readFile(path.join(scenesDir, file), 'utf-8');
    const fileErrors: string[] = [];

    let match: RegExpExecArray | null;
    interpRegex.lastIndex = 0;
    while ((match = interpRegex.exec(content)) !== null) {
      const inItems = match[1].split(',').map((s) => s.trim()).filter(Boolean);
      const outItems = match[2].split(',').map((s) => s.trim()).filter(Boolean);

      if (inItems.length !== outItems.length) {
        fileErrors.push(
          `[Remotion Runtime] interpolate() inputRange length (${inItems.length}) !== outputRange length (${outItems.length}) near "${match[0]}"`
        );
      }

      const nums = inItems.map((s) => Number(s));
      if (nums.every((n) => Number.isFinite(n))) {
        for (let i = 1; i < nums.length; i++) {
          if (nums[i] <= nums[i - 1]) {
            fileErrors.push(
              `[Remotion Runtime] interpolate() inputRange must be strictly increasing, got [${inItems.join(', ')}]`
            );
            break;
          }
        }
      }
    }

    if (fileErrors.length > 0) {
      errorsByFile[relPath] = fileErrors;
    }
  }

  return errorsByFile;
}

/**
 * Runs `tsc --noEmit --pretty false -p tsconfig.json` inside the generated project directory
 * and groups all TypeScript errors by relative file path.
 */
export async function runProjectCompileCheck(outputDir: string): Promise<CompileCheckResult> {
  const tscBin = path.resolve(process.cwd(), 'node_modules/.bin/tsc');

  try {
    await execFileAsync(tscBin, ['--noEmit', '--pretty', 'false', '-p', 'tsconfig.json'], {
      cwd: outputDir,
    });

    const runtimeErrors = await checkRemotionRuntimeSafety(outputDir);
    if (Object.keys(runtimeErrors).length > 0) {
      return {
        success: false,
        errorsByFile: runtimeErrors,
        generalErrors: [],
        rawOutput: Object.entries(runtimeErrors)
          .map(([f, errs]) => `${f}: ${errs.join('; ')}`)
          .join('\n'),
      };
    }

    return {
      success: true,
      errorsByFile: {},
      generalErrors: [],
      rawOutput: '',
    };
  } catch (err: any) {
    const rawOutput = [err.stdout || '', err.stderr || ''].filter(Boolean).join('\n').trim();
    const errorsByFile: Record<string, string[]> = {};
    const generalErrors: string[] = [];

    const lines = rawOutput.split(/\r?\n/);
    const diagRegex = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const match = trimmed.match(diagRegex);
      if (match) {
        const [, rawFile, lineNum, colNum, code, msg] = match;
        const normalizedFile = rawFile.replace(/\\/g, '/').replace(/^\.\//, '');
        if (!errorsByFile[normalizedFile]) {
          errorsByFile[normalizedFile] = [];
        }
        errorsByFile[normalizedFile].push(`Line ${lineNum}:${colNum} [${code}] ${msg}`);
      } else if (trimmed.includes('error TS')) {
        generalErrors.push(trimmed);
      }
    }

    return {
      success: false,
      errorsByFile,
      generalErrors,
      rawOutput,
    };
  }
}

