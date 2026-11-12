import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import type { LLMResult } from '@langchain/core/outputs';

export interface ModelPricing {
  inputPer1M: number;
  cachedInputPer1M?: number;
  outputPer1M: number;
}

/**
 * Verified API pricing rates (USD per 1M tokens).
 * Matched by exact name or longest prefix match.
 */
const MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI GPT-6 / 5.6 (standard tier, checked Nov 2026)
  'gpt-6-astra': { inputPer1M: 10.0, cachedInputPer1M: 1.0, outputPer1M: 50.0 },
  'gpt-6.1-sol': { inputPer1M: 2.0, cachedInputPer1M: 0.1, outputPer1M: 10.0 },
  'gpt-6.1-terra': { inputPer1M: 1.0, cachedInputPer1M: 0.05, outputPer1M: 5.0 },
  'gpt-6-luna': { inputPer1M: 0.1, cachedInputPer1M: 0.01, outputPer1M: 0.5 },
  'gpt-5.6-terra': { inputPer1M: 2.0, cachedInputPer1M: 0.2, outputPer1M: 12.0 },
  'gpt-5.6-luna': { inputPer1M: 0.2, cachedInputPer1M: 0.02, outputPer1M: 1.2 },

  // Anthropic Claude 5.5 (Haiku price = prompts up to 100K tokens)
  'claude-opus-5-5': { inputPer1M: 4.0, cachedInputPer1M: 0.2, outputPer1M: 20.0 },
  'claude-sonnet-5-5': { inputPer1M: 2.0, cachedInputPer1M: 0.2, outputPer1M: 10.0 },
  'claude-haiku-5-5': { inputPer1M: 0.1, cachedInputPer1M: 0.01, outputPer1M: 0.5 },

  // Google Gemini 3.x (checked Oct/Nov 2026)
  'gemini-3.8-flash': { inputPer1M: 0.75, outputPer1M: 3.75 },
  'gemini-3.1-pro': { inputPer1M: 2.0, outputPer1M: 12.0 },

  // OpenAI GPT-5 series
  'gpt-5-nano': { inputPer1M: 0.05, cachedInputPer1M: 0.005, outputPer1M: 0.40 },
  'gpt-5-mini': { inputPer1M: 0.25, cachedInputPer1M: 0.025, outputPer1M: 2.00 },
  'gpt-5': { inputPer1M: 1.25, cachedInputPer1M: 0.125, outputPer1M: 10.00 },

  // OpenAI GPT-4o series
  'gpt-4o-mini': { inputPer1M: 0.15, cachedInputPer1M: 0.075, outputPer1M: 0.60 },
  'gpt-4o': { inputPer1M: 2.50, cachedInputPer1M: 1.25, outputPer1M: 10.00 },

  // Google Gemini 3.1, 2.5 & TTS series
  'gemini-3.1-flash-tts': { inputPer1M: 1.00, outputPer1M: 20.00 },
  'gemini-3.1-flash-lite': { inputPer1M: 0.25, cachedInputPer1M: 0.025, outputPer1M: 1.50 },
  'gemini-2.5-flash-preview-tts': { inputPer1M: 0.50, outputPer1M: 10.00 },
  'gemini-2.5-flash': { inputPer1M: 0.30, cachedInputPer1M: 0.03, outputPer1M: 2.50 },
  'gemini-2.5-pro': { inputPer1M: 1.25, cachedInputPer1M: 0.125, outputPer1M: 10.00 },

  // Anthropic Claude 3.5 series
  'claude-3-5-sonnet': { inputPer1M: 3.00, cachedInputPer1M: 0.30, outputPer1M: 15.00 },
};

export interface LLMCallRecord {
  stage: string;
  provider: string;
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  pricingFound: boolean;
  durationMs: number;
  timestamp: string;
}

function findPricing(provider: string, modelName: string): ModelPricing | null {
  if (provider === 'ollama') {
    return { inputPer1M: 0, cachedInputPer1M: 0, outputPer1M: 0 };
  }

  const normalized = modelName.toLowerCase();
  // Strip OpenRouter vendor prefix if present (e.g. "openai/gpt-4o" -> "gpt-4o")
  const cleanName = normalized.includes('/') ? normalized.split('/').pop()! : normalized;

  // Sort keys descending by length so "gpt-5-nano" matches before "gpt-5"
  const sortedKeys = Object.keys(MODEL_PRICING).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (cleanName === key || cleanName.startsWith(key)) {
      return MODEL_PRICING[key];
    }
  }
  return null;
}

function extractTokenUsage(output: LLMResult): {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
} {
  const gen = output.generations?.[0]?.[0] as any;
  const usageMeta = gen?.message?.usage_metadata;

  if (usageMeta) {
    const inputTokens = Number(usageMeta.input_tokens ?? 0);
    const outputTokens = Number(usageMeta.output_tokens ?? 0);
    const cachedInputTokens = Number(usageMeta.input_token_details?.cache_read ?? 0);
    const totalTokens = Number(usageMeta.total_tokens ?? inputTokens + outputTokens);
    return { inputTokens, cachedInputTokens, outputTokens, totalTokens };
  }

  const llmUsage = output.llmOutput?.tokenUsage || output.llmOutput?.estimatedTokenUsage;
  if (llmUsage) {
    const inputTokens = Number(llmUsage.promptTokens ?? llmUsage.input_tokens ?? 0);
    const outputTokens = Number(llmUsage.completionTokens ?? llmUsage.output_tokens ?? 0);
    const totalTokens = Number(llmUsage.totalTokens ?? inputTokens + outputTokens);
    return { inputTokens, cachedInputTokens: 0, outputTokens, totalTokens };
  }

  return { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, totalTokens: 0 };
}

class StageCostCallbackHandler extends BaseCallbackHandler {
  name = 'StageCostCallbackHandler';
  private startTimes = new Map<string, number>();

  constructor(
    private tracker: CostTracker,
    private stage: string,
    private provider: string,
    private modelName: string
  ) {
    super();
  }

  override handleChatModelStart(_llm: any, _messages: any, runId: string): void {
    this.startTimes.set(runId, Date.now());
  }

  override handleLLMStart(_llm: any, _prompts: string[], runId: string): void {
    this.startTimes.set(runId, Date.now());
  }

  override handleLLMEnd(output: LLMResult, runId: string): void {
    const startTime = this.startTimes.get(runId);
    this.startTimes.delete(runId);
    const durationMs = startTime ? Date.now() - startTime : 0;

    const usage = extractTokenUsage(output);
    this.tracker.recordCall({
      stage: this.stage,
      provider: this.provider,
      model: this.modelName,
      ...usage,
      durationMs,
    });
  }
}

export class CostTracker {
  private records: LLMCallRecord[] = [];

  reset(): void {
    this.records = [];
  }

  createCallbackHandler(stage: string, provider: string, modelName: string): BaseCallbackHandler {
    return new StageCostCallbackHandler(this, stage, provider, modelName);
  }

  recordCall(input: {
    stage: string;
    provider: string;
    model: string;
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    totalTokens: number;
    durationMs: number;
  }): LLMCallRecord {
    const pricing = findPricing(input.provider, input.model);
    let costUsd = 0;

    if (pricing) {
      const nonCachedInput = Math.max(0, input.inputTokens - input.cachedInputTokens);
      const cachedRate = pricing.cachedInputPer1M ?? pricing.inputPer1M;
      costUsd =
        (nonCachedInput / 1_000_000) * pricing.inputPer1M +
        (input.cachedInputTokens / 1_000_000) * cachedRate +
        (input.outputTokens / 1_000_000) * pricing.outputPer1M;
    }

    const record: LLMCallRecord = {
      ...input,
      costUsd,
      pricingFound: pricing !== null,
      timestamp: new Date().toISOString(),
    };

    this.records.push(record);

    const costLabel = record.pricingFound ? `$${record.costUsd.toFixed(6)}` : 'N/A (unknown rate)';
    const cacheInfo = record.cachedInputTokens > 0 ? ` (cached: ${record.cachedInputTokens})` : '';
    const sec = (record.durationMs / 1000).toFixed(2);

    console.log(
      `  💰 [Cost | ${record.stage} | ${record.provider}/${record.model}] ` +
        `In: ${record.inputTokens}${cacheInfo} | Out: ${record.outputTokens} | ` +
        `Total: ${record.totalTokens} tok | Cost: ${costLabel} | ${sec}s`
    );

    return record;
  }

  getSummary() {
    const totalCalls = this.records.length;
    const totalInputTokens = this.records.reduce((acc, r) => acc + r.inputTokens, 0);
    const totalCachedTokens = this.records.reduce((acc, r) => acc + r.cachedInputTokens, 0);
    const totalOutputTokens = this.records.reduce((acc, r) => acc + r.outputTokens, 0);
    const totalTokens = this.records.reduce((acc, r) => acc + r.totalTokens, 0);
    const totalCostUsd = this.records.reduce((acc, r) => acc + r.costUsd, 0);
    const totalDurationMs = this.records.reduce((acc, r) => acc + r.durationMs, 0);

    const byStage: Record<string, { calls: number; tokens: number; costUsd: number }> = {};
    for (const r of this.records) {
      if (!byStage[r.stage]) {
        byStage[r.stage] = { calls: 0, tokens: 0, costUsd: 0 };
      }
      byStage[r.stage].calls += 1;
      byStage[r.stage].tokens += r.totalTokens;
      byStage[r.stage].costUsd += r.costUsd;
    }

    return {
      totalCalls,
      totalInputTokens,
      totalCachedTokens,
      totalOutputTokens,
      totalTokens,
      totalCostUsd,
      totalDurationMs,
      byStage,
      records: [...this.records],
    };
  }

  printSummary(): void {
    const summary = this.getSummary();
    if (summary.totalCalls === 0) {
      return;
    }

    console.log('\n========================================================================');
    console.log('💵 EXPENSE SUMMARY (LLM & TTS COST SUMMARY)');
    console.log('========================================================================');
    for (const [stage, stats] of Object.entries(summary.byStage)) {
      console.log(
        `  • ${stage.padEnd(22)} : ${String(stats.calls).padStart(2)} call(s) | ${stats.tokens.toLocaleString()} tok | $${stats.costUsd.toFixed(6)}`
      );
    }
    console.log('------------------------------------------------------------------------');
    console.log(`  Total API Calls        : ${summary.totalCalls}`);
    console.log(
      `  Total Input Tokens     : ${summary.totalInputTokens.toLocaleString()} (Cached: ${summary.totalCachedTokens.toLocaleString()})`
    );
    console.log(`  Total Output Tokens    : ${summary.totalOutputTokens.toLocaleString()}`);
    console.log(`  Total Tokens           : ${summary.totalTokens.toLocaleString()}`);
    console.log(`  Total API Duration     : ${(summary.totalDurationMs / 1000).toFixed(2)}s`);
    console.log(`  TOTAL COST             : $${summary.totalCostUsd.toFixed(6)} USD`);
    console.log('========================================================================\n');
  }
}

export const costTracker = new CostTracker();

