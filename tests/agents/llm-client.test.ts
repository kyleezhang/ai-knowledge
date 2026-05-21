import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { AgentError } from '../../src/agents/errors.js';
import { default_agent_config } from '../../src/agents/config.js';
import {
  __test_only__,
  AnthropicLlmClient,
  create_llm_client,
  type AnthropicMessagesApi,
} from '../../src/agents/llm-client.js';

const default_chat_model =
  default_agent_config.model.providers.deepseek.models.chat;

function fake_messages_api(input: {
  text?: string;
  error?: Error;
  on_create?: (request: Parameters<AnthropicMessagesApi['create']>[0]) => void;
}): AnthropicMessagesApi {
  return {
    create: async (request) => {
      input.on_create?.(request);
      if (input.error !== undefined) {
        throw input.error;
      }
      return { content: [{ type: 'text', text: input.text ?? '' }] };
    },
  };
}

describe('LLM client', () => {
  it('generates text through the injected messages API', async () => {
    let model: string | undefined;
    const client = new AnthropicLlmClient({
      default_model: default_chat_model,
      messages: fake_messages_api({
        text: 'hello',
        on_create: (request) => {
          model = request.model;
        },
      }),
    });

    const result = await client.generate_text({
      system_prompt: 'system',
      user_prompt: 'user',
    });

    expect(result.text).toBe('hello');
    expect(model).toBe(default_chat_model);
  });

  it('generates JSON and validates it with Zod', async () => {
    const client = new AnthropicLlmClient({
      default_model: default_chat_model,
      messages: fake_messages_api({ text: '{"answer":"ok"}' }),
    });

    const result = await client.generate_json({
      system_prompt: 'system',
      user_prompt: 'user',
      schema: z.object({ answer: z.string() }),
    });

    expect(result).toEqual({ answer: 'ok' });
  });

  it('wraps LLM call failures as AgentError', async () => {
    const client = new AnthropicLlmClient({
      default_model: default_chat_model,
      messages: fake_messages_api({ error: new Error('network failed') }),
    });

    await expect(
      client.generate_text({ system_prompt: 'system', user_prompt: 'user' }),
    ).rejects.toMatchObject({
      name: 'AgentError',
      code: 'LLM_CALL_FAILED',
    } satisfies Partial<AgentError>);
  });

  it('recovers JSON from a fenced json block', async () => {
    const client = new AnthropicLlmClient({
      default_model: default_chat_model,
      messages: fake_messages_api({
        text: 'Here is the result:\n```json\n{"answer":"ok"}\n```',
      }),
    });

    await expect(
      client.generate_json({
        system_prompt: 'system',
        user_prompt: 'user',
        schema: z.object({ answer: z.string() }),
      }),
    ).resolves.toEqual({ answer: 'ok' });
  });

  it('recovers JSON from a single top-level object embedded in text', async () => {
    const client = new AnthropicLlmClient({
      default_model: default_chat_model,
      messages: fake_messages_api({
        text: 'Result follows. {"answer":"ok"} Thanks.',
      }),
    });

    await expect(
      client.generate_json({
        system_prompt: 'system',
        user_prompt: 'user',
        schema: z.object({ answer: z.string() }),
      }),
    ).resolves.toEqual({ answer: 'ok' });
  });

  it('wraps invalid JSON output as AgentError when recovery fails', async () => {
    const client = new AnthropicLlmClient({
      default_model: default_chat_model,
      messages: fake_messages_api({ text: 'not json' }),
    });

    await expect(
      client.generate_json({
        system_prompt: 'system',
        user_prompt: 'user',
        schema: z.object({ answer: z.string() }),
      }),
    ).rejects.toMatchObject({ code: 'LLM_OUTPUT_PARSE_FAILED' });
  });

  it('wraps schema validation failure as AgentError after recovery', async () => {
    const client = new AnthropicLlmClient({
      default_model: default_chat_model,
      messages: fake_messages_api({ text: '```json\n{"answer":1}\n```' }),
    });

    await expect(
      client.generate_json({
        system_prompt: 'system',
        user_prompt: 'user',
        schema: z.object({ answer: z.string() }),
      }),
    ).rejects.toMatchObject({ code: 'LLM_OUTPUT_SCHEMA_FAILED' });
  });

  it('does not recover when multiple different JSON objects are present', () => {
    expect(
      __test_only__.extract_single_top_level_json_object(
        'first {"a":1} second {"a":2}',
      ),
    ).toBeNull();
  });

  it('uses injected fake messages without real network calls', async () => {
    const previous = process.env.DEEPSEEK_API_KEY;
    process.env.DEEPSEEK_API_KEY = 'test-key';

    try {
      const client = create_llm_client(
        {},
        fake_messages_api({ text: 'fake response' }),
      );

      await expect(
        client.generate_text({ system_prompt: 'system', user_prompt: 'user' }),
      ).resolves.toEqual({ text: 'fake response' });
    } finally {
      if (previous === undefined) {
        delete process.env.DEEPSEEK_API_KEY;
      } else {
        process.env.DEEPSEEK_API_KEY = previous;
      }
    }
  });
});
