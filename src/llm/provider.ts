import 'dotenv/config';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { costTracker } from '../core/cost-tracker.js';

export type SupportedProvider = 'openai' | 'anthropic' | 'google' | 'openrouter' | 'ollama' | 'custom';

export interface ModelConfig {
  provider?: SupportedProvider;
  /** max output tokens (stage YAML max_tokens) */
  maxTokens?: number;
  modelName?: string;
  apiKey?: string;
  baseURL?: string;
  temperature?: number;
}

function isOpenAIReasoningModel(model: string): boolean {
  if (/^o\d/.test(model)) return true;
  if (model.startsWith('gpt-5') && !model.startsWith('gpt-5-chat')) return true;
  return false;
}

/**
 * Returns a unified BaseChatModel instance using LangChain.js
 * with automatic per-call token & cost tracking via LangChain callbacks.
 */
export function getModel(config?: ModelConfig, stageLabel: string = 'llm'): BaseChatModel {
  const provider = (config?.provider || process.env.DEFAULT_MODEL_PROVIDER || 'openai') as SupportedProvider;
  const modelName = config?.modelName || process.env.DEFAULT_MODEL_NAME;
  const temperature = config?.temperature ?? 0.2;

  switch (provider) {
    case 'openai': {
      const resolvedModel = modelName || 'gpt-4o';
      // OpenAI reasoning & GPT-5 models (gpt-5, gpt-5-nano, o1, o3) reject non-default temperature values
      const resolvedTemp = isOpenAIReasoningModel(resolvedModel) ? undefined : temperature;

      return new ChatOpenAI({
        model: resolvedModel,
        ...(config?.maxTokens ? { maxTokens: config.maxTokens } : {}),
        apiKey: config?.apiKey || process.env.OPENAI_API_KEY,
        ...(resolvedTemp !== undefined ? { temperature: resolvedTemp } : {}),
        callbacks: [costTracker.createCallbackHandler(stageLabel, provider, resolvedModel)],
        configuration: {
          baseURL: config?.baseURL || process.env.OPENAI_BASE_URL,
        },
      });
    }

    case 'anthropic': {
      const resolvedModel = modelName || 'claude-sonnet-5-5';
      // Claude 5.x (Opus/Sonnet 5.5, Fable, Mythos) reject non-default sampling params -> omit temperature
      const claude5 = /claude-(opus|sonnet|haiku|fable|mythos)-5/i.test(resolvedModel);
      return new ChatAnthropic({
        modelName: resolvedModel,
        maxTokens: config?.maxTokens ?? 8000,
        apiKey: config?.apiKey || process.env.ANTHROPIC_API_KEY,
        ...(claude5 ? {} : { temperature }),
        callbacks: [costTracker.createCallbackHandler(stageLabel, provider, resolvedModel)],
      });
    }

    case 'google': {
      const resolvedModel = modelName || 'gemini-2.5-flash';
      return new ChatGoogleGenerativeAI({
        model: resolvedModel,
        ...(config?.maxTokens ? { maxOutputTokens: config.maxTokens } : {}),
        apiKey: config?.apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY,
        temperature,
        callbacks: [costTracker.createCallbackHandler(stageLabel, provider, resolvedModel)],
      });
    }

    case 'openrouter': {
      const resolvedModel = modelName || 'anthropic/claude-3.5-sonnet';
      return new ChatOpenAI({
        model: resolvedModel,
        ...(config?.maxTokens ? { maxTokens: config.maxTokens } : {}),
        apiKey: config?.apiKey || process.env.OPENROUTER_API_KEY,
        temperature,
        callbacks: [costTracker.createCallbackHandler(stageLabel, provider, resolvedModel)],
        configuration: {
          baseURL: config?.baseURL || 'https://openrouter.ai/api/v1',
        },
      });
    }

    case 'ollama': {
      const resolvedModel = modelName || 'llama3.2';
      return new ChatOpenAI({
        model: resolvedModel,
        ...(config?.maxTokens ? { maxTokens: config.maxTokens } : {}),
        apiKey: 'ollama',
        temperature,
        callbacks: [costTracker.createCallbackHandler(stageLabel, provider, resolvedModel)],
        configuration: {
          baseURL: config?.baseURL || process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
        },
      });
    }

    case 'custom': {
      const resolvedModel = modelName || 'default-model';
      return new ChatOpenAI({
        model: resolvedModel,
        ...(config?.maxTokens ? { maxTokens: config.maxTokens } : {}),
        apiKey: config?.apiKey || process.env.OPENAI_API_KEY || 'dummy',
        temperature,
        callbacks: [costTracker.createCallbackHandler(stageLabel, provider, resolvedModel)],
        configuration: {
          baseURL: config?.baseURL || process.env.OPENAI_BASE_URL || 'http://localhost:8000/v1',
        },
      });
    }

    default:
      throw new Error(`Unsupported LangChain provider: ${provider}`);
  }
}
