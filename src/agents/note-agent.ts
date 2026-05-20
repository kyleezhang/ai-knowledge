import type { Source } from '../domain/source.js';
import type { SourceRef } from '../domain/note.js';
import { NoteCandidateSchema, type NoteCandidate } from './schemas.js';
import { load_prompt } from './prompt-loader.js';
import type { LlmClient } from './types.js';
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
  return input.llm_client.generate_json({
    system_prompt,
    user_prompt: build_note_user_prompt(input.agent_input),
    schema: NoteCandidateSchema,
  });
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
