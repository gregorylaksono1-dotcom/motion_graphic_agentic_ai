import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { LlmClient, StructuredRequest } from '../types.js';

/**
 * Native provider APIs (OpenAI, Anthropic, Google, OpenRouter, Ollama, custom) through LangChain.
 * Cost tracking happens in the LangChain callback attached by getModel().
 */
export class DirectLlmClient implements LlmClient {
  constructor(
    private readonly chatModel: BaseChatModel,
    readonly provider: string,
    readonly model: string,
    readonly stage: string
  ) {}

  async generateStructured<T>(req: StructuredRequest<T>): Promise<T> {
    const structured = this.chatModel.withStructuredOutput(req.schema as any, { name: req.schemaName });
    return (await structured.invoke([new SystemMessage(req.system), new HumanMessage(req.user)])) as T;
  }
}
