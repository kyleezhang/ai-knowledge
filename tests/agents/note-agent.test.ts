import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  build_note_user_prompt,
  note_agent,
  type NoteAgentInput,
} from '../../src/agents/note-agent.js';
import { AgentError } from '../../src/agents/errors.js';
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

  it('retries once when the LLM output fails schema validation', async () => {
    const schema_error = new AgentError({
      code: 'LLM_OUTPUT_SCHEMA_FAILED',
      message: 'LLM JSON output failed schema validation.',
      details: [
        {
          path: ['why_it_matters'],
          message: 'Invalid input: expected array, received string',
        },
      ],
    });
    const llm_client = new FakeLlmClient([
      schema_error,
      {
        title: 'Retried Note',
        conclusions: ['Confirmed conclusion'],
        why_it_matters: ['It matters.'],
        current_understanding: 'Current understanding.',
        open_questions: [],
        related_note_ids: [],
        source_refs: agent_input.source_refs,
      },
    ]);

    const result = await note_agent({ llm_client, agent_input });

    expect(result.title).toBe('Retried Note');
    expect(llm_client.inputs).toHaveLength(2);
    expect(llm_client.inputs[1].user_prompt).toContain(
      'Previous Output Schema Error',
    );
  });

  it('retries once when conclusions do not match allowed conclusions exactly', async () => {
    const llm_client = new FakeLlmClient([
      {
        title: 'Paraphrased Note',
        conclusions: ['Paraphrased conclusion'],
        why_it_matters: ['It matters.'],
        current_understanding: 'Current understanding.',
        open_questions: [],
        related_note_ids: [],
        source_refs: agent_input.source_refs,
      },
      {
        title: 'Retried Note',
        conclusions: ['Confirmed conclusion'],
        why_it_matters: ['It matters.'],
        current_understanding: 'Current understanding.',
        open_questions: [],
        related_note_ids: [],
        source_refs: agent_input.source_refs,
      },
    ]);

    const result = await note_agent({ llm_client, agent_input });

    expect(result.conclusions).toEqual(['Confirmed conclusion']);
    expect(llm_client.inputs).toHaveLength(2);
    expect(llm_client.inputs[1].user_prompt).toContain(
      'Previous Output Semantic Error',
    );
  });

  it('rejects schema-invalid candidate after retry', async () => {
    const schema_error = new AgentError({
      code: 'LLM_OUTPUT_SCHEMA_FAILED',
      message: 'LLM JSON output failed schema validation.',
    });
    const llm_client = new FakeLlmClient([schema_error, schema_error]);

    await expect(note_agent({ llm_client, agent_input })).rejects.toThrow(
      'LLM JSON output failed schema validation.',
    );
  });
});
