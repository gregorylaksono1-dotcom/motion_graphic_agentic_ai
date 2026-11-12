import type { ZodType } from 'zod';

export interface StructuredRequest<T> {
  system: string;
  user: string;
  schema: ZodType<T>;
  /** function/tool name used for structured output, e.g. "storyboard_decomposer" */
  schemaName: string;
}

/** Per-stage generation settings (from the stage YAML `model:` block + env) */
export interface LlmCallSettings {
  temperature?: number;
  maxTokens?: number;
  reasoningEffort?: 'low' | 'medium' | 'high';
}

/**
 * One interface for every LLM backend. Stages only ever call `generateStructured`,
 * so swapping providers (OpenAI / Anthropic / Google / OpenRouter / Ollama) needs no stage code changes.
 */
export interface LlmClient {
  readonly provider: string;
  readonly model: string;
  readonly stage: string;
  generateStructured<T>(req: StructuredRequest<T>): Promise<T>;
}
