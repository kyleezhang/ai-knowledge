import type { DiscussionAgentOutput } from '../agents/schemas.js';
import {
  create_llm_client,
  type AnthropicMessagesApi,
} from '../agents/llm-client.js';
import {
  discussion_agent,
  type DiscussionAgentInput,
} from '../agents/discussion-agent.js';
import type { LlmClient } from '../agents/types.js';
import { transition_source } from '../domain/state-machine.js';
import type { Source } from '../domain/source.js';
import { parse_source } from '../domain/source.js';
import { read_processed_artifacts } from '../storage/artifact-store.js';
import type { StorageConfig } from '../storage/config.js';
import {
  append_discussion_message,
  read_discussion_messages,
} from '../storage/discussion-log.js';
import { StorageError } from '../storage/errors.js';
import { get_source, save_source } from '../storage/source-repo.js';
import { summarize_source, type SourceSummary } from './source-summary.js';
import type { WorkflowResult } from './types.js';

const recent_message_limit = 12;
const segment_limit = 8;

export type DiscussSourceWorkflowInput = {
  source_id: string;
  user_message: string;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
  now?: Date;
  llm_client?: LlmClient;
  messages_api?: AnthropicMessagesApi;
  discuss?: (input: {
    llm_client: LlmClient;
    agent_input: DiscussionAgentInput;
  }) => Promise<DiscussionAgentOutput>;
};

export type DiscussSourceWorkflowData = {
  source_id: string;
  source: SourceSummary;
  assistant_message: string;
  discussion_summary: Source['discussion_summary'];
};

export async function discuss_source_workflow(
  input: DiscussSourceWorkflowInput,
): Promise<WorkflowResult<DiscussSourceWorkflowData>> {
  const context = { config: input.storage_config, cwd: input.cwd };
  let source: Source;

  try {
    source = await get_source(input.source_id, context);
  } catch (error) {
    return storage_error_result(error);
  }

  if (
    source.status !== 'understanding_ready' &&
    source.status !== 'discussing'
  ) {
    return {
      ok: false,
      error: {
        code: 'INVALID_STATE',
        message: `Source must be understanding_ready or discussing before discussion. Current status: ${source.status}`,
      },
    };
  }

  if (source.draft_understanding === null) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Source must have draft_understanding before discussion.',
      },
    };
  }
  const draft_understanding = source.draft_understanding;

  const now = input.now ?? new Date();
  const timestamp = now.toISOString();

  try {
    if (source.status === 'understanding_ready') {
      source = parse_source({
        ...transition_source(source, 'discussing'),
        updated_at: timestamp,
      });
      await save_source(source, context);
    }

    await append_discussion_message(
      source.id,
      {
        role: 'user',
        content: input.user_message,
        created_at: timestamp,
      },
      context,
    );

    const messages = await read_discussion_messages(source.id, context);
    const artifacts = await read_processed_artifacts(source, context);
    const agent_input: DiscussionAgentInput = {
      source_title: source.title,
      draft_understanding,
      current_discussion_summary: source.discussion_summary,
      recent_messages: messages.slice(-recent_message_limit),
      user_message: input.user_message,
      relevant_segments: artifacts.segments.slice(0, segment_limit),
      related_notes: [],
      input_truncated: artifacts.segments.length > segment_limit,
    };
    const llm_client =
      input.llm_client ?? create_llm_client({}, input.messages_api);
    const discuss = input.discuss ?? discussion_agent;
    const output = await discuss({ llm_client, agent_input });

    await append_discussion_message(
      source.id,
      {
        role: 'assistant',
        content: output.assistant_message,
        created_at: timestamp,
      },
      context,
    );

    const discussion_summary = {
      ...source.discussion_summary,
      ...output.discussion_summary_update,
      discussion_status: output.discussion_summary_update.ready_for_approval
        ? 'ready_for_approval'
        : 'open',
      summary_version: source.discussion_summary.summary_version + 1,
      last_updated_at: timestamp,
    } satisfies Source['discussion_summary'];

    source = parse_source({
      ...source,
      discussion_summary,
      last_error: undefined,
      updated_at: timestamp,
    });
    await save_source(source, context);

    return {
      ok: true,
      data: {
        source_id: source.id,
        source: summarize_source(source),
        assistant_message: output.assistant_message,
        discussion_summary,
      },
    };
  } catch (error) {
    const discussing_source = ensure_discussing_source(source, timestamp);
    const failed_discussion_source = parse_source({
      ...discussing_source,
      updated_at: timestamp,
      last_error: {
        stage: 'discussion',
        message: error instanceof Error ? error.message : 'Discussion failed.',
        occurred_at: timestamp,
      },
    });

    try {
      await save_source(failed_discussion_source, context);
    } catch (save_error) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_FAILED',
          message:
            'Discussion failed and Source discussion error could not be saved.',
          cause: save_error,
        },
      };
    }

    return {
      ok: false,
      error: {
        code: error instanceof StorageError ? 'STORAGE_FAILED' : 'AGENT_FAILED',
        message: error instanceof Error ? error.message : 'Discussion failed.',
        cause: error,
      },
    };
  }
}

function ensure_discussing_source(source: Source, timestamp: string): Source {
  if (source.status === 'discussing') {
    return source;
  }
  return parse_source({
    ...transition_source(source, 'discussing'),
    updated_at: timestamp,
  });
}

function storage_error_result(
  error: unknown,
): WorkflowResult<DiscussSourceWorkflowData> {
  if (error instanceof StorageError && error.code === 'NOT_FOUND') {
    return {
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: error.message,
        cause: error,
      },
    };
  }

  return {
    ok: false,
    error: {
      code: 'STORAGE_FAILED',
      message:
        error instanceof Error ? error.message : 'Storage operation failed.',
      cause: error,
    },
  };
}
