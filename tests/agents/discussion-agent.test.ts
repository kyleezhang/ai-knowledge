import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  build_discussion_user_prompt,
  discussion_agent,
  type DiscussionAgentInput,
} from '../../src/agents/discussion-agent.js';
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

  constructor(private readonly output: unknown) {}

  async generate_text(): Promise<GenerateTextResult> {
    return { text: '' };
  }

  async generate_json<TSchema extends z.ZodType>(
    input: GenerateJsonInput<TSchema>,
  ): Promise<z.infer<TSchema>> {
    this.last_input = input;
    return input.schema.parse(this.output) as z.infer<TSchema>;
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

  it('rejects schema-invalid output', async () => {
    const llm_client = new FakeLlmClient({
      assistant_message: 'Bad shape',
      discussion_summary_update: {
        confirmed_points: 'invalid',
        open_questions: [],
        unresolved_issues: [],
        next_prompts: [],
        ready_for_approval: false,
      },
    });

    await expect(
      discussion_agent({ llm_client, agent_input }),
    ).rejects.toThrow();
  });
});
