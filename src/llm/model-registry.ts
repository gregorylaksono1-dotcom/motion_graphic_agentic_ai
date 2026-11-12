import type { SupportedProvider } from './provider.js';

/**
 * Stage config uses the NATIVE model id (as the provider names it, e.g. "gemini-3.8-flash", "claude-sonnet-5-5").
 * The provider is inferred from the name, or forced with a prefix, e.g. "openrouter:anthropic/claude-sonnet-5-5".
 */

const PROVIDER_PREFIXES: SupportedProvider[] = ['openai', 'anthropic', 'google', 'openrouter', 'ollama', 'custom'];

export interface ParsedModel {
  /** explicit provider prefix if given ("openrouter:..."), else null */
  forcedProvider: SupportedProvider | null;
  /** model id without prefix */
  id: string;
}

export function parseModel(spec: string): ParsedModel {
  const trimmed = (spec || '').trim();
  const m = trimmed.match(/^([a-z]+):(.+)$/i);
  if (m && (PROVIDER_PREFIXES as string[]).includes(m[1].toLowerCase())) {
    return { forcedProvider: m[1].toLowerCase() as SupportedProvider, id: m[2].trim() };
  }
  return { forcedProvider: null, id: trimmed };
}

/** Which provider SDK serves this model */
export function inferProvider(spec: string): SupportedProvider {
  const { forcedProvider, id } = parseModel(spec);
  if (forcedProvider) return forcedProvider;
  const lower = id.toLowerCase();
  if (lower.startsWith('claude')) return 'anthropic';
  if (lower.startsWith('gemini')) return 'google';
  if (/^(gpt|o\d|chatgpt)/.test(lower)) return 'openai';
  return (process.env.DEFAULT_MODEL_PROVIDER as SupportedProvider) || 'openai';
}

/** API key env var each provider needs (for early, readable errors) */
export const PROVIDER_KEY_ENV: Partial<Record<SupportedProvider, string[]>> = {
  openai: ['OPENAI_API_KEY'],
  anthropic: ['ANTHROPIC_API_KEY'],
  google: ['GOOGLE_GENERATIVE_AI_API_KEY', 'GEMINI_API_KEY'],
  openrouter: ['OPENROUTER_API_KEY'],
};
