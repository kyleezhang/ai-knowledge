import type { GenerateJsonInput, LlmClient } from './types.js';
import { AgentError } from './errors.js';
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
  const request = {
    system_prompt,
    user_prompt: build_understand_user_prompt(input.agent_input),
    schema: DraftUnderstandingCandidateSchema,
  } satisfies GenerateJsonInput<typeof DraftUnderstandingCandidateSchema>;

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
        'Regenerate the draft_understanding JSON now. Preserve the same semantics, but every item in `key_points`, `uncertainties`, and `discussion_starters` must be a plain string, not an object.',
      ].join('\n'),
    });
  }
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

function is_schema_error(error: unknown): error is AgentError {
  return (
    error instanceof AgentError && error.code === 'LLM_OUTPUT_SCHEMA_FAILED'
  );
}
