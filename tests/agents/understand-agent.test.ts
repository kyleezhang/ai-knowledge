import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  build_understand_user_prompt,
  understand_agent,
  type UnderstandAgentInput,
} from '../../src/agents/understand-agent.js';
import type {
  GenerateJsonInput,
  GenerateTextResult,
  LlmClient,
} from '../../src/agents/types.js';

const agent_input: UnderstandAgentInput = {
  source_title: 'Test Source',
  source_metadata: {
    title: 'Test Source',
    headings: [{ level: 1, title: 'Test Source' }],
    links: [],
    segment_count: 1,
    processed_at: '2026-05-14T00:00:00.000Z',
  },
  segments: [
    {
      id: 'seg_0001',
      order: 1,
      heading_path: ['Test Source'],
      text: 'Body text.',
      locator: {
        ref: 'processed/segments.json#seg_0001',
        source_kind: 'markdown',
        position: 1,
        heading_path: ['Test Source'],
      },
    },
  ],
  clean_text_summary: '# Test Source\n\nBody text.\n',
  related_notes: [],
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

describe('understand agent', () => {
  it('builds structured user prompt sections', () => {
    const prompt = build_understand_user_prompt(agent_input);

    expect(prompt).toContain('## Source Title');
    expect(prompt).toContain('## Source Metadata');
    expect(prompt).toContain('## Segments');
    expect(prompt).toContain('## Input Truncated');
    expect(prompt).toContain('Body text.');
  });

  it('loads draft prompt and returns schema-valid candidate output', async () => {
    const llm_client = new FakeLlmClient({
      summary: 'Summary',
      key_points: ['Point'],
      uncertainties: ['Unclear'],
      discussion_starters: ['Question?'],
    });

    const result = await understand_agent({ llm_client, agent_input });

    expect(result.summary).toBe('Summary');
    expect(llm_client.last_input?.system_prompt).toContain('Understand Agent');
    expect(llm_client.last_input?.user_prompt).toContain('Test Source');
  });

  it('rejects schema-invalid candidate output', async () => {
    const llm_client = new FakeLlmClient({
      summary: 'Summary',
      key_points: 'invalid',
      uncertainties: [],
      discussion_starters: [],
    });

    await expect(
      understand_agent({ llm_client, agent_input }),
    ).rejects.toThrow();
  });
});
