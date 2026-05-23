import type { Note } from '../domain/note.js';
import { AgentError } from './errors.js';
import { GroundedAnswerSchema, type GroundedAnswer } from './schemas.js';
import { load_prompt } from './prompt-loader.js';
import type { GenerateJsonInput, LlmClient } from './types.js';

export type AnswerAgentInput = {
  question: string;
  approved_notes: Note[];
};

export async function answer_agent(input: {
  llm_client: LlmClient;
  agent_input: AnswerAgentInput;
}): Promise<GroundedAnswer> {
  const system_prompt = await load_prompt('answer-grounded.md');
  const request = {
    system_prompt,
    user_prompt: build_answer_user_prompt(input.agent_input),
    schema: GroundedAnswerSchema,
  } satisfies GenerateJsonInput<typeof GroundedAnswerSchema>;

  try {
    return await input.llm_client.generate_json(request);
  } catch (error) {
    if (!is_schema_error(error)) {
      throw error;
    }

    return input.llm_client.generate_json({
      ...request,
      user_prompt: [
        request.user_prompt,
        '',
        '## Previous Output Schema Error',
        json_block(error.details),
        '',
        'Regenerate the grounded answer JSON now. Preserve the same semantics, but fix the schema exactly. Pay special attention that `cited_notes`, each `relevant_points`, `unconfirmed_materials`, and `limitations` must be arrays.',
      ].join('\n'),
    });
  }
}

export function build_answer_user_prompt(input: AnswerAgentInput): string {
  return [
    '## Question',
    input.question,
    '',
    '## Approved Notes',
    json_block(input.approved_notes),
    '',
    '## P0 Rules',
    '- Use only approved Notes as evidence.',
    '- Do not fallback to Source, draft_understanding, or discussion_summary.',
    '- Return unconfirmed_materials as an empty array.',
  ].join('\n');
}

function json_block(value: unknown): string {
  return `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
}

function is_schema_error(error: unknown): error is AgentError {
  return error instanceof AgentError && error.code === 'LLM_OUTPUT_SCHEMA_FAILED';
}
