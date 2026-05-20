import type { Source } from '../domain/source.js';
import type { ProcessedSegment } from '../storage/artifact-store.js';
import {
  DiscussionAgentOutputSchema,
  type DiscussionAgentOutput,
  type DiscussionMessage,
} from './schemas.js';
import { load_prompt } from './prompt-loader.js';
import type { LlmClient } from './types.js';
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
  return input.llm_client.generate_json({
    system_prompt,
    user_prompt: build_discussion_user_prompt(input.agent_input),
    schema: DiscussionAgentOutputSchema,
  });
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
