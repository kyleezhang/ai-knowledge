import type { Source } from '../domain/source.js';
import type { ProcessedSegment } from '../storage/artifact-store.js';
import { AgentError } from './errors.js';
import {
  DiscussionAgentOutputSchema,
  type DiscussionAgentOutput,
  type DiscussionMessage,
} from './schemas.js';
import { load_prompt } from './prompt-loader.js';
import type { GenerateJsonInput, LlmClient } from './types.js';
import type { RetrievedNoteSummary } from './understand-agent.js';

export type DiscussionAgentInput = {
  source_title: string;
  draft_understanding: NonNullable<Source['draft_understanding']>;
  current_discussion_summary: Source['discussion_summary'];
  recent_messages: DiscussionMessage[];
  user_message: string;
  relevant_segments?: ProcessedSegment[];
  related_notes?: RetrievedNoteSummary[];
  input_truncated: boolean;
};

export async function discussion_agent(input: {
  llm_client: LlmClient;
  agent_input: DiscussionAgentInput;
}): Promise<DiscussionAgentOutput> {
  const system_prompt = await load_prompt('discussion-reply.md');
  const request = {
    system_prompt,
    user_prompt: build_discussion_user_prompt(input.agent_input),
    schema: DiscussionAgentOutputSchema,
  } satisfies GenerateJsonInput<typeof DiscussionAgentOutputSchema>;
  const output = await generate_schema_valid_discussion_output(
    input.llm_client,
    request,
  );

  if (output.discussion_summary_update.confirmed_points.length > 0) {
    return output;
  }

  const explicit_confirmation = extract_explicit_confirmation(
    input.agent_input.user_message,
  );
  if (explicit_confirmation === null) {
    return output;
  }

  return {
    ...output,
    discussion_summary_update: {
      ...output.discussion_summary_update,
      confirmed_points: [explicit_confirmation],
      open_questions: [],
      unresolved_issues: [],
      ready_for_approval: true,
    },
  };
}

async function generate_schema_valid_discussion_output(
  llm_client: LlmClient,
  request: GenerateJsonInput<typeof DiscussionAgentOutputSchema>,
): Promise<DiscussionAgentOutput> {
  try {
    return await llm_client.generate_json(request);
  } catch (error) {
    if (!is_json_output_error(error)) {
      throw error;
    }

    return llm_client.generate_json({
      ...request,
      user_prompt: [
        request.user_prompt,
        '',
        '## Previous Output Error',
        json_block({
          code: error.code,
          details: error.details,
          message: error.message,
        }),
        '',
        'Regenerate the discussion response now as a strict JSON object only. Do not include Markdown, explanation text, or code fences. Make all summary update fields match the required array/boolean types exactly.',
      ].join('\n'),
    });
  }
}

export function build_discussion_user_prompt(
  input: DiscussionAgentInput,
): string {
  return [
    '## Source Title',
    input.source_title,
    '',
    '## Draft Understanding',
    json_block(input.draft_understanding),
    '',
    '## Current Discussion Summary',
    json_block(input.current_discussion_summary),
    '',
    '## Recent Messages',
    json_block(input.recent_messages),
    '',
    '## User Message',
    input.user_message,
    '',
    '## Relevant Segments',
    json_block(input.relevant_segments ?? []),
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

function is_json_output_error(error: unknown): error is AgentError {
  return (
    error instanceof AgentError &&
    (error.code === 'LLM_OUTPUT_PARSE_FAILED' ||
      error.code === 'LLM_OUTPUT_SCHEMA_FAILED')
  );
}

function extract_explicit_confirmation(message: string): string | null {
  const match = /I explicitly confirm this point for the final note:\s*(.+?)(?:\s+There are no open questions|$)/iu.exec(
    message,
  );
  const confirmed_point = match?.[1]?.trim();
  return confirmed_point === undefined || confirmed_point.length === 0
    ? null
    : confirmed_point;
}
