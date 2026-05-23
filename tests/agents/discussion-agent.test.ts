import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  build_discussion_user_prompt,
  discussion_agent,
  type DiscussionAgentInput,
} from '../../src/agents/discussion-agent.js';
import { AgentError } from '../../src/agents/errors.js';
import type {
  GenerateJsonInput,
  GenerateTextResult,
  LlmClient,
} from '../../src/agents/types.js';

const agent_input: DiscussionAgentInput = {
  source_title: 'Test Source',
  draft_understanding: {
    summary: 'Draft summary',
    key_points: ['Draft point'],
    uncertainties: ['Draft uncertainty'],
    discussion_starters: ['Starter?'],
    generated_at: '2026-05-14T00:00:00.000Z',
  },
  current_discussion_summary: {
    discussion_status: 'open',
    summary_version: 0,
    confirmed_points: [],
    open_questions: [],
    unresolved_issues: [],
    next_prompts: [],
    ready_for_approval: false,
    last_updated_at: '2026-05-14T00:00:00.000Z',
  },
  recent_messages: [],
  user_message: 'I think this matters for agents.',
  input_truncated: false,
};

class FakeLlmClient implements LlmClient {
  last_input: GenerateJsonInput<z.ZodType> | undefined;
  inputs: GenerateJsonInput<z.ZodType>[] = [];
  private index = 0;

  constructor(private readonly outputs: unknown | unknown[]) {}

  async generate_text(): Promise<GenerateTextResult> {
    return { text: '' };
  }

  async generate_json<TSchema extends z.ZodType>(
    input: GenerateJsonInput<TSchema>,
  ): Promise<z.infer<TSchema>> {
    this.last_input = input;
    this.inputs.push(input);
    const outputs = Array.isArray(this.outputs) ? this.outputs : [this.outputs];
    const output = outputs[Math.min(this.index, outputs.length - 1)];
    this.index += 1;
    if (output instanceof Error) {
      throw output;
    }
    return input.schema.parse(output) as z.infer<TSchema>;
  }
}

describe('discussion agent', () => {
  it('builds structured user prompt sections', () => {
    const prompt = build_discussion_user_prompt(agent_input);

    expect(prompt).toContain('## Draft Understanding');
    expect(prompt).toContain('## Current Discussion Summary');
    expect(prompt).toContain('## Recent Messages');
    expect(prompt).toContain('I think this matters for agents.');
  });

  it('loads discussion prompt and returns schema-valid output', async () => {
    const llm_client = new FakeLlmClient({
      assistant_message: 'Good point.',
      discussion_summary_update: {
        confirmed_points: ['Agents matter.'],
        open_questions: [],
        unresolved_issues: [],
        next_prompts: ['How would you apply this?'],
        ready_for_approval: false,
      },
    });

    const result = await discussion_agent({ llm_client, agent_input });

    expect(result.assistant_message).toBe('Good point.');
    expect(llm_client.last_input?.system_prompt).toContain('Discussion Agent');
    expect(llm_client.last_input?.user_prompt).toContain('Draft summary');
  });

  it('retries once when LLM output is not valid JSON', async () => {
    const parse_error = new AgentError({
      code: 'LLM_OUTPUT_PARSE_FAILED',
      message: 'LLM output is not valid JSON.',
    });
    const llm_client = new FakeLlmClient([
      parse_error,
      {
        assistant_message: 'Good point.',
        discussion_summary_update: {
          confirmed_points: ['Agents matter.'],
          open_questions: [],
          unresolved_issues: [],
          next_prompts: [],
          ready_for_approval: true,
        },
      },
    ]);

    const result = await discussion_agent({ llm_client, agent_input });

    expect(result.discussion_summary_update.confirmed_points).toEqual([
      'Agents matter.',
    ]);
    expect(llm_client.inputs).toHaveLength(2);
    expect(llm_client.inputs[1].user_prompt).toContain(
      'Previous Output Error',
    );
  });

  it('derives confirmed points from explicit user confirmation when model omits them', async () => {
    const llm_client = new FakeLlmClient({
      assistant_message: 'Acknowledged.',
      discussion_summary_update: {
        confirmed_points: [],
        open_questions: ['Question'],
        unresolved_issues: ['Issue'],
        next_prompts: [],
        ready_for_approval: false,
      },
    });

    const result = await discussion_agent({
      llm_client,
      agent_input: {
        ...agent_input,
        user_message:
          'I explicitly confirm this point for the final note: Only approved Notes should be indexed and used for grounded answers in the P0 workflow. There are no open questions or unresolved issues.',
      },
    });

    expect(result.discussion_summary_update.confirmed_points).toEqual([
      'Only approved Notes should be indexed and used for grounded answers in the P0 workflow.',
    ]);
    expect(result.discussion_summary_update.open_questions).toEqual([]);
    expect(result.discussion_summary_update.unresolved_issues).toEqual([]);
    expect(result.discussion_summary_update.ready_for_approval).toBe(true);
  });

  it('rejects schema-invalid output after retry', async () => {
    const schema_error = new AgentError({
      code: 'LLM_OUTPUT_SCHEMA_FAILED',
      message: 'LLM JSON output failed schema validation.',
    });
    const llm_client = new FakeLlmClient([schema_error, schema_error]);

    await expect(
      discussion_agent({ llm_client, agent_input }),
    ).rejects.toThrow('LLM JSON output failed schema validation.');
  });
});
