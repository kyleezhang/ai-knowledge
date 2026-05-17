import type { DraftUnderstandingCandidate } from '../agents/schemas.js';
import {
  create_llm_client,
  type AnthropicMessagesApi,
} from '../agents/llm-client.js';
import {
  understand_agent,
  type UnderstandAgentInput,
} from '../agents/understand-agent.js';
import type { LlmClient } from '../agents/types.js';
import { transition_source } from '../domain/state-machine.js';
import type { Source } from '../domain/source.js';
import { parse_source } from '../domain/source.js';
import { read_processed_artifacts } from '../storage/artifact-store.js';
import type { StorageConfig } from '../storage/config.js';
import { StorageError } from '../storage/errors.js';
import { get_source, save_source } from '../storage/source-repo.js';
import { summarize_source, type SourceSummary } from './source-summary.js';
import type { NextAction, WorkflowResult } from './types.js';

const clean_text_budget = 4_000;

export type UnderstandSourceWorkflowInput = {
  source_id: string;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
  now?: Date;
  llm_client?: LlmClient;
  messages_api?: AnthropicMessagesApi;
  understand?: (input: {
    llm_client: LlmClient;
    agent_input: UnderstandAgentInput;
  }) => Promise<DraftUnderstandingCandidate>;
};

export type UnderstandSourceWorkflowData = {
  source_id: string;
  source: SourceSummary;
  draft_understanding: NonNullable<Source['draft_understanding']>;
};

export async function understand_source_workflow(
  input: UnderstandSourceWorkflowInput,
): Promise<WorkflowResult<UnderstandSourceWorkflowData>> {
  const context = { config: input.storage_config, cwd: input.cwd };
  let source: Source;

  try {
    source = await get_source(input.source_id, context);
  } catch (error) {
    return storage_error_result(error);
  }

  if (source.status !== 'processed') {
    return {
      ok: false,
      error: {
        code: 'INVALID_STATE',
        message: `Source must be processed before understanding. Current status: ${source.status}`,
      },
    };
  }

  const now = input.now ?? new Date();
  const timestamp = now.toISOString();

  try {
    const artifacts = await read_processed_artifacts(source, context);
    const clean_text_summary = artifacts.clean_text.slice(0, clean_text_budget);
    const agent_input: UnderstandAgentInput = {
      source_title: source.title,
      source_metadata: artifacts.metadata,
      segments: artifacts.segments,
      clean_text_summary,
      related_notes: [],
      input_truncated: artifacts.clean_text.length > clean_text_budget,
    };
    const llm_client =
      input.llm_client ?? create_llm_client({}, input.messages_api);
    const understand = input.understand ?? understand_agent;
    const candidate = await understand({ llm_client, agent_input });
    const draft_understanding = {
      ...candidate,
      generated_at: timestamp,
    };

    source = parse_source({
      ...transition_source(
        {
          ...source,
          draft_understanding,
          last_error: undefined,
          updated_at: timestamp,
        },
        'understanding_ready',
      ),
      draft_understanding,
      last_error: undefined,
      updated_at: timestamp,
    });
    await save_source(source, context);

    return {
      ok: true,
      data: {
        source_id: source.id,
        source: summarize_source(source),
        draft_understanding,
      },
      next_actions: next_actions_for_source(source.id),
    };
  } catch (error) {
    const failed_source = parse_source({
      ...transition_source(source, 'failed'),
      updated_at: timestamp,
      last_error: {
        stage: 'understanding',
        message:
          error instanceof Error ? error.message : 'Understanding failed.',
        occurred_at: timestamp,
      },
    });

    try {
      await save_source(failed_source, context);
    } catch (save_error) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_FAILED',
          message:
            'Understanding failed and Source failure state could not be saved.',
          cause: save_error,
        },
      };
    }

    return {
      ok: false,
      error: {
        code: error instanceof StorageError ? 'STORAGE_FAILED' : 'AGENT_FAILED',
        message:
          error instanceof Error ? error.message : 'Understanding failed.',
        cause: error,
      },
    };
  }
}

function storage_error_result(
  error: unknown,
): WorkflowResult<UnderstandSourceWorkflowData> {
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

function next_actions_for_source(source_id: string): NextAction[] {
  return [
    {
      label: 'Discuss source',
      command: `ai-knowledge source discuss ${source_id}`,
    },
  ];
}
