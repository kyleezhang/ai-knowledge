import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  build_note_user_prompt,
  note_agent,
  type NoteAgentInput,
} from '../../src/agents/note-agent.js';
import type {
  GenerateJsonInput,
  GenerateTextResult,
  LlmClient,
} from '../../src/agents/types.js';
import { create_test_source } from '../source-test-helpers.js';

const source = create_test_source({
  status: 'approved_for_note',
  processing_artifacts: {
    clean_text: 'processed/clean_text.md',
    segments: 'processed/segments.json',
    metadata: 'processed/metadata.json',
  },
  draft_understanding: {
    summary: 'Draft summary',
    key_points: ['Draft point'],
    uncertainties: [],
    discussion_starters: [],
    generated_at: '2026-05-14T00:00:00.000Z',
  },
  discussion_summary: {
    ...create_test_source().discussion_summary,
    summary_version: 2,
    confirmed_points: ['Confirmed conclusion'],
    ready_for_approval: true,
    discussion_status: 'closed',
  },
});

const agent_input: NoteAgentInput = {
  source,
  draft_understanding: source.draft_understanding!,
  discussion_summary: source.discussion_summary,
  source_refs: [
    {
      source_id: source.id,
      source_title: source.title,
      source_url: null,
      evidence_refs: ['processed/segments.json#seg_0001'],
    },
  ],
  related_notes: [],
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

describe('note agent', () => {
  it('builds prompt with allowed conclusions', () => {
    const prompt = build_note_user_prompt(agent_input);

    expect(prompt).toContain('## Allowed Conclusions');
    expect(prompt).toContain('Confirmed conclusion');
    expect(prompt).toContain('## Source Refs');
  });

  it('loads compose prompt and returns schema-valid candidate', async () => {
    const llm_client = new FakeLlmClient({
      title: 'Test Note',
      conclusions: ['Confirmed conclusion'],
      why_it_matters: ['It matters.'],
      current_understanding: 'Current understanding.',
      open_questions: [],
      related_note_ids: [],
      source_refs: agent_input.source_refs,
    });

    const result = await note_agent({ llm_client, agent_input });

    expect(result.title).toBe('Test Note');
    expect(llm_client.last_input?.system_prompt).toContain('Note Agent');
  });

  it('rejects schema-invalid candidate', async () => {
    const llm_client = new FakeLlmClient({
      title: 'Test Note',
      conclusions: 'invalid',
      why_it_matters: [],
      current_understanding: 'Current understanding.',
      open_questions: [],
      related_note_ids: [],
      source_refs: agent_input.source_refs,
    });

    await expect(note_agent({ llm_client, agent_input })).rejects.toThrow();
  });
});
