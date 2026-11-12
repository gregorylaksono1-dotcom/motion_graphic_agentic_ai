import 'dotenv/config';
import { promptLoader } from '../core/prompt-loader.js';
import { getModel, type ModelConfig } from './provider.js';
import type { LlmClient, LlmCallSettings } from './types.js';
import { DirectLlmClient } from './clients/direct-client.js';
import { PROVIDER_KEY_ENV, inferProvider, parseModel } from './model-registry.js';

/** Fallback only — the real defaults live in each stage YAML (`model.name`) */
const FALLBACK_MODEL: Record<number, string> = {
  0: 'gemini-3.8-flash',
  1: 'claude-sonnet-5-5',
  2: 'gemini-3.8-flash',
  3: 'claude-sonnet-5-5',
};

function stageIndex(stageFile: string): number {
  const m = stageFile.match(/stage(\d)/);
  return m ? Number(m[1]) : 1;
}

export interface StageModel {
  /** native model id (may carry a provider prefix) */
  model: string;
  settings: LlmCallSettings;
}

/** Model + settings for a stage: STAGE{n}_MODEL (.env) > YAML model.name > fallback */
export function resolveStageModel(stageFile: string, override?: ModelConfig): StageModel {
  const n = stageIndex(stageFile);
  const yaml = promptLoader.load(stageFile).model || {};
  const model =
    override?.modelName ||
    process.env[`STAGE${n}_MODEL`]?.trim() ||
    (yaml.name as string | undefined) ||
    FALLBACK_MODEL[n] ||
    FALLBACK_MODEL[1];
  return {
    model,
    settings: {
      temperature: override?.temperature ?? (yaml.temperature as number | undefined),
      maxTokens: yaml.max_tokens ? Number(yaml.max_tokens) : undefined,
      reasoningEffort: yaml.reasoning_effort as LlmCallSettings['reasoningEffort'],
    },
  };
}

/**
 * Factory (polymorphism): the stage asks for "an LLM"; the model name decides the provider.
 *   claude-*  -> Anthropic   gemini-* -> Google   gpt-* / o* -> OpenAI
 *   prefix "openrouter:" / "ollama:" / "custom:" forces a route.
 */
export function createStageLlm(stageFile: string, override?: ModelConfig): LlmClient {
  const { model, settings } = resolveStageModel(stageFile, override);
  const provider = override?.provider || inferProvider(model);
  const { id } = parseModel(model);
  const keyEnvs = PROVIDER_KEY_ENV[provider];
  if (!override?.apiKey && keyEnvs && !keyEnvs.some((k) => process.env[k] && !process.env[k]!.startsWith('your_'))) {
    throw new Error(
      `Stage ${stageFile} memakai ${id} via ${provider}, tapi ${keyEnvs.join(' / ')} belum diisi. Isi key-nya atau ganti STAGE${stageIndex(stageFile)}_MODEL.`
    );
  }
  const chat = getModel(
    { provider, modelName: id, apiKey: override?.apiKey, baseURL: override?.baseURL, temperature: settings.temperature, maxTokens: settings.maxTokens },
    stageFile
  );
  return new DirectLlmClient(chat, provider, id, stageFile);
}

/** "provider / model" for the startup banner */
export function describeStageLlm(stageFile: string): string {
  const { model } = resolveStageModel(stageFile);
  return `${inferProvider(model)} / ${parseModel(model).id}`;
}
