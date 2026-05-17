import type { LlmClient } from './types.js';
import { load_prompt } from './prompt-loader.js';
import {
  DraftUnderstandingCandidateSchema,
  type DraftUnderstandingCandidate,
} from './schemas.js';
import type {
  ProcessedMetadata,
  ProcessedSegment,
} from '../storage/artifact-store.js';

export type RetrievedNoteSummary = {
  note_id: string;
  title: string;
  summary: string;
};

export type UnderstandAgentInput = {
  source_title: string;
  source_metadata: ProcessedMetadata;
  segments: ProcessedSegment[];
  clean_text_summary?: string;
  related_notes?: RetrievedNoteSummary[];
  input_truncated: boolean;
};

export async function understand_agent(input: {
  llm_client: LlmClient;
  agent_input: UnderstandAgentInput;
}): Promise<DraftUnderstandingCandidate> {
  const system_prompt = await load_prompt('draft-understanding.md');
  return input.llm_client.generate_json({
    system_prompt,
    user_prompt: build_understand_user_prompt(input.agent_input),
    schema: DraftUnderstandingCandidateSchema,
  });
}

export function build_understand_user_prompt(
  input: UnderstandAgentInput,
): string {
  return [
    '## Source Title',
    input.source_title,
    '',
    '## Source Metadata',
    json_block(input.source_metadata),
    '',
    '## Segments',
    json_block(input.segments),
    '',
    '## Clean Text Summary',
    input.clean_text_summary ?? '',
    '',
    '## Related Approved Notes',
    json_block(input.related_notes ?? []),
    '',
    '## Input Truncated',
    String(input.input_truncated),
  ].join('\n');
}

function json_block(value: unknown): string {
  return `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
}
