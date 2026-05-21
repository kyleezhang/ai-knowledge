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
    const candidate_texts = recover_json_candidates(text);
    let parsed: unknown;
    let parse_error: unknown;

    for (const candidate_text of candidate_texts) {
      try {
        parsed = JSON.parse(candidate_text);
        parse_error = undefined;
        break;
      } catch (error) {
        parse_error = error;
      }
    }

    if (parse_error !== undefined) {
      throw new AgentError({
        code: 'LLM_OUTPUT_PARSE_FAILED',
        message: 'LLM output is not valid JSON.',
        cause: parse_error,
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

function recover_json_candidates(text: string): string[] {
  const candidates = new Set<string>();
  candidates.add(text);

  for (const match of text.matchAll(/```(?:json)?\s*([\s\S]*?)```/giu)) {
    const candidate = match[1].trim();
    if (candidate.length > 0) {
      candidates.add(candidate);
    }
  }

  const object_candidate = extract_single_top_level_json_object(text);
  if (object_candidate !== null) {
    candidates.add(object_candidate);
  }

  return Array.from(candidates);
}

function extract_single_top_level_json_object(text: string): string | null {
  const starts: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '{') {
      starts.push(i);
    }
  }

  let recovered: string | null = null;
  for (const start of starts) {
    const candidate = extract_balanced_json_object(text, start);
    if (candidate === null) {
      continue;
    }

    if (recovered !== null && recovered !== candidate) {
      return null;
    }
    recovered = candidate;
  }

  return recovered;
}

function extract_balanced_json_object(
  text: string,
  start_index: number,
): string | null {
  let depth = 0;
  let in_string = false;
  let escaping = false;

  for (let i = start_index; i < text.length; i += 1) {
    const char = text[i];

    if (in_string) {
      if (escaping) {
        escaping = false;
        continue;
      }
      if (char === '\\') {
        escaping = true;
        continue;
      }
      if (char === '"') {
        in_string = false;
      }
      continue;
    }

    if (char === '"') {
      in_string = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start_index, i + 1).trim();
      }
      if (depth < 0) {
        return null;
      }
    }
  }

  return null;
}

export const __test_only__ = {
  recover_json_candidates,
  extract_single_top_level_json_object,
};
