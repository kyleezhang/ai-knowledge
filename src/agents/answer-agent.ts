import type { Note } from '../domain/note.js';
import { GroundedAnswerSchema, type GroundedAnswer } from './schemas.js';
import { load_prompt } from './prompt-loader.js';
import type { LlmClient } from './types.js';

export type AnswerAgentInput = {
  question: string;
  approved_notes: Note[];
};

export async function answer_agent(input: {
  llm_client: LlmClient;
  agent_input: AnswerAgentInput;
}): Promise<GroundedAnswer> {
  const system_prompt = await load_prompt('answer-grounded.md');
  return input.llm_client.generate_json({
    system_prompt,
    user_prompt: build_answer_user_prompt(input.agent_input),
    schema: GroundedAnswerSchema,
  });
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
