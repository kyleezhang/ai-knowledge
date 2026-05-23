import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  answer_agent,
  build_answer_user_prompt,
  type AnswerAgentInput,
} from '../../src/agents/answer-agent.js';
import { AgentError } from '../../src/agents/errors.js';
import type {
  GenerateJsonInput,
  GenerateTextResult,
  LlmClient,
} from '../../src/agents/types.js';
import { create_test_note } from '../note-test-helpers.js';

const agent_input: AnswerAgentInput = {
  question: 'What do we know about agent memory?',
  approved_notes: [
    create_test_note({
      status: 'approved',
      approved_at: '2026-05-14T00:00:00.000Z',
      quality_checks: {
        status: 'passed',
        template_complete: true,
        source_links_present: true,
        empty_sections: [],
        last_checked_at: '2026-05-14T00:00:00.000Z',
      },
    }),
  ],
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

describe('answer agent', () => {
  it('builds prompt with approved notes and no fallback rules', () => {
    const prompt = build_answer_user_prompt(agent_input);

    expect(prompt).toContain('## Approved Notes');
    expect(prompt).toContain('Do not fallback to Source');
  });

  it('loads answer prompt and returns schema-valid answer', async () => {
    const llm_client = new FakeLlmClient({
      conclusion: 'Agent memory helps.',
      cited_notes: [
        {
          note_id: agent_input.approved_notes[0].id,
          title: agent_input.approved_notes[0].title,
          relevant_points: ['Confirmed conclusion'],
        },
      ],
      unconfirmed_materials: [],
      limitations: [],
    });

    const result = await answer_agent({ llm_client, agent_input });

    expect(result.conclusion).toBe('Agent memory helps.');
    expect(llm_client.last_input?.system_prompt).toContain('Answer Agent');
  });

  it('retries once when the LLM output fails schema validation', async () => {
    const schema_error = new AgentError({
      code: 'LLM_OUTPUT_SCHEMA_FAILED',
      message: 'LLM JSON output failed schema validation.',
      details: [
        {
          path: ['cited_notes', 0, 'relevant_points'],
          message: 'Invalid input: expected array, received string',
        },
      ],
    });
    const llm_client = new FakeLlmClient([
      schema_error,
      {
        conclusion: 'Agent memory helps.',
        cited_notes: [
          {
            note_id: agent_input.approved_notes[0].id,
            title: agent_input.approved_notes[0].title,
            relevant_points: ['Confirmed conclusion'],
          },
        ],
        unconfirmed_materials: [],
        limitations: [],
      },
    ]);

    const result = await answer_agent({ llm_client, agent_input });

    expect(result.conclusion).toBe('Agent memory helps.');
    expect(llm_client.inputs).toHaveLength(2);
    expect(llm_client.inputs[1].user_prompt).toContain(
      'Previous Output Schema Error',
    );
  });

  it('rejects schema-invalid output after retry', async () => {
    const schema_error = new AgentError({
      code: 'LLM_OUTPUT_SCHEMA_FAILED',
      message: 'LLM JSON output failed schema validation.',
    });
    const llm_client = new FakeLlmClient([schema_error, schema_error]);

    await expect(answer_agent({ llm_client, agent_input })).rejects.toThrow(
      'LLM JSON output failed schema validation.',
    );
  });
});
