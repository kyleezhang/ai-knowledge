import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { resolve_agent_model_config } from './config.js';
import { AgentError } from './errors.js';
import type {
  GenerateJsonInput,
  GenerateTextInput,
  GenerateTextResult,
  LlmClient,
  LlmClientConfig,
} from './types.js';

export type AnthropicMessagesApi = {
  create(input: {
    model: string;
    max_tokens: number;
    system: string;
    messages: Anthropic.MessageParam[];
    temperature?: number;
  }): Promise<{ content: Array<{ type: string; text?: string }> }>;
};

export function create_llm_client(
  config: LlmClientConfig = {},
  messages_api?: AnthropicMessagesApi,
): LlmClient {
  const model_config = resolve_agent_model_config(config);
  const messages =
    messages_api ??
    new Anthropic({
      apiKey: model_config.api_key,
      authToken: model_config.auth_token || null,
      baseURL: model_config.base_url,
    }).messages;

  return new AnthropicLlmClient({
    messages,
    default_model: model_config.model,
  });
}

export class AnthropicLlmClient implements LlmClient {
  constructor(
    private readonly input: {
      messages: AnthropicMessagesApi;
      default_model: string;
    },
  ) {}

  async generate_text(input: GenerateTextInput): Promise<GenerateTextResult> {
    try {
      const response = await this.input.messages.create({
        model: input.model ?? this.input.default_model,
        max_tokens: input.max_tokens ?? 16_000,
        system: input.system_prompt,
        messages: [{ role: 'user', content: input.user_prompt }],
        ...(input.temperature === undefined
          ? {}
          : { temperature: input.temperature }),
      });

      return {
        text: response.content
          .filter((block) => block.type === 'text' && block.text !== undefined)
          .map((block) => block.text)
          .join(''),
      };
    } catch (error) {
      throw new AgentError({
        code: 'LLM_CALL_FAILED',
        message: error instanceof Error ? error.message : 'LLM call failed.',
        cause: error,
      });
    }
  }

  async generate_json<TSchema extends z.ZodType>(
    input: GenerateJsonInput<TSchema>,
  ): Promise<z.infer<TSchema>> {
    const text = (await this.generate_text(input)).text;
    let parsed: unknown;

    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new AgentError({
        code: 'LLM_OUTPUT_PARSE_FAILED',
        message: 'LLM output is not valid JSON.',
        cause: error,
        details: { output: text },
      });
    }

    try {
      return input.schema.parse(parsed) as z.infer<TSchema>;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AgentError({
          code: 'LLM_OUTPUT_SCHEMA_FAILED',
          message: 'LLM JSON output failed schema validation.',
          cause: error,
          details: error.issues,
        });
      }
      throw error;
    }
  }
}
