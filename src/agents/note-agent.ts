import type { Source } from '../domain/source.js';
import type { SourceRef } from '../domain/note.js';
import { NoteCandidateSchema, type NoteCandidate } from './schemas.js';
import { AgentError } from './errors.js';
import { load_prompt } from './prompt-loader.js';
import type { GenerateJsonInput, LlmClient } from './types.js';
import type { RetrievedNoteSummary } from './understand-agent.js';

export type NoteAgentInput = {
  source: Source;
  draft_understanding: NonNullable<Source['draft_understanding']>;
  discussion_summary: Source['discussion_summary'];
  source_refs: SourceRef[];
  related_notes?: RetrievedNoteSummary[];
};

export async function note_agent(input: {
  llm_client: LlmClient;
  agent_input: NoteAgentInput;
}): Promise<NoteCandidate> {
  const system_prompt = await load_prompt('compose-note-json.md');
  const request = {
    system_prompt,
    user_prompt: build_note_user_prompt(input.agent_input),
    schema: NoteCandidateSchema,
  } satisfies GenerateJsonInput<typeof NoteCandidateSchema>;

  const candidate = await generate_schema_valid_note_candidate(
    input.llm_client,
    request,
  );
  const unsupported_conclusions = candidate.conclusions.filter(
    (item) =>
      !input.agent_input.discussion_summary.confirmed_points.includes(item),
  );

  if (unsupported_conclusions.length === 0) {
    return candidate;
  }

  return generate_schema_valid_note_candidate(input.llm_client, {
    ...request,
    user_prompt: [
      request.user_prompt,
      '',
      '## Previous Output Semantic Error',
      json_block({
        unsupported_conclusions,
        allowed_conclusions:
          input.agent_input.discussion_summary.confirmed_points,
      }),
      '',
      'Regenerate the Note JSON now. Preserve the same semantics, but every `conclusions` item must exactly match one item from Allowed Conclusions.',
    ].join('\n'),
  });
}

async function generate_schema_valid_note_candidate(
  llm_client: LlmClient,
  request: GenerateJsonInput<typeof NoteCandidateSchema>,
): Promise<NoteCandidate> {
  try {
    return await llm_client.generate_json(request);
  } catch (error) {
    if (!is_schema_error(error)) {
      throw error;
    }

    return llm_client.generate_json({
      ...request,
      user_prompt: [
        request.user_prompt,
        '',
        '## Previous Output Schema Error',
        json_block(error.details),
        '',
        'Regenerate the Note JSON now. Preserve the same semantics, but fix the schema exactly. Pay special attention that `why_it_matters`, `conclusions`, `open_questions`, `related_note_ids`, and `source_refs` must be arrays.',
      ].join('\n'),
    });
  }
}

export function build_note_user_prompt(input: NoteAgentInput): string {
  return [
    '## Source',
    json_block(input.source),
    '',
    '## Draft Understanding',
    json_block(input.draft_understanding),
    '',
    '## Discussion Summary',
    json_block(input.discussion_summary),
    '',
    '## Allowed Conclusions',
    json_block(input.discussion_summary.confirmed_points),
    '',
    '## Source Refs',
    json_block(input.source_refs),
    '',
    '## Related Approved Notes',
    json_block(input.related_notes ?? []),
  ].join('\n');
}

function json_block(value: unknown): string {
  return `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
}

function is_schema_error(error: unknown): error is AgentError {
  return (
    error instanceof AgentError && error.code === 'LLM_OUTPUT_SCHEMA_FAILED'
  );
}
