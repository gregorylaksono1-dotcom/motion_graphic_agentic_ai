import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

export interface YamlModelConfig {
  /** native model id, e.g. "claude-sonnet-5-5" or "gemini-3.8-flash" (optional "provider:" prefix) */
  name?: string;
  temperature?: number;
  max_tokens?: number;
  reasoning_effort?: 'low' | 'medium' | 'high';
}

export interface PromptConfig {
  name: string;
  version: string;
  description: string;
  model?: YamlModelConfig;
  system_prompt: string;
  user_prompt_template?: string;
  [key: string]: any;
}

class PromptLoader {
  private cache: Map<string, PromptConfig> = new Map();
  private promptsDir: string;

  constructor(promptsDir: string = './prompts') {
    this.promptsDir = path.resolve(process.cwd(), promptsDir);
  }

  /**
   * Loads a YAML prompt file by filename (e.g. "stage1-scriptwriter.yml")
   */
  load(fileName: string): PromptConfig {
    if (this.cache.has(fileName)) {
      return this.cache.get(fileName)!;
    }

    const filePath = path.join(
      this.promptsDir,
      fileName.endsWith('.yml') || fileName.endsWith('.yaml') ? fileName : `${fileName}.yml`
    );

    if (!fs.existsSync(filePath)) {
      throw new Error(`Prompt configuration file not found at: ${filePath}`);
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const parsed = YAML.parse(fileContent) as PromptConfig;
    this.cache.set(fileName, parsed);
    return parsed;
  }

  /**
   * Replaces mustache-like placeholders {{variable}} with their actual values
   */
  interpolate(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => {
      return variables[key] !== undefined ? String(variables[key]) : `{{${key}}}`;
    });
  }
}

export const promptLoader = new PromptLoader();
