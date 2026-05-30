import {
  check_discussion_convergence,
  format_discussion_convergence_failure_reasons,
} from '../domain/discussion-convergence.js';
import { transition_source } from '../domain/state-machine.js';
import { parse_source } from '../domain/source.js';
import type { StorageConfig } from '../storage/config.js';
import { StorageError } from '../storage/errors.js';
import { get_source, save_source } from '../storage/source-repo.js';
import { summarize_source, type SourceSummary } from './source-summary.js';
import type { NextAction, WorkflowError, WorkflowResult } from './types.js';

export type ApproveSourceWorkflowInput = {
  source_id: string;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
  now?: Date;
};

export type ApproveSourceWorkflowData = {
  source_id: string;
  source: SourceSummary;
};

export async function approve_source_workflow(
  input: ApproveSourceWorkflowInput,
): Promise<WorkflowResult<ApproveSourceWorkflowData>> {
  const context = { config: input.storage_config, cwd: input.cwd };

  try {
    const source = await get_source(input.source_id, context);
    if (source.status !== 'discussing') {
      return invalid_state(
        `Source must be discussing before approval. Current status: ${source.status}`,
      );
    }
    const convergence = check_discussion_convergence(source);
    if (!convergence.passed) {
      return invalid_state(
        'Discussion has not converged and cannot be approved.',
        {
          reasons: convergence.reasons,
          messages: format_discussion_convergence_failure_reasons(
            convergence.reasons,
          ),
        },
      );
    }
    const summary = source.discussion_summary;

    const timestamp = (input.now ?? new Date()).toISOString();
    const updated_source = parse_source({
      ...transition_source(
        {
          ...source,
          discussion_summary: {
            ...summary,
            discussion_status: 'closed',
            next_prompts: summary.next_prompts,
            last_updated_at: timestamp,
          },
          updated_at: timestamp,
        },
        'approved_for_note',
      ),
      discussion_summary: {
        ...summary,
        discussion_status: 'closed',
        next_prompts: summary.next_prompts,
        last_updated_at: timestamp,
      },
      updated_at: timestamp,
    });

    await save_source(updated_source, context);

    return {
      ok: true,
      data: {
        source_id: updated_source.id,
        source: summarize_source(updated_source),
      },
      next_actions: next_actions_for_source(updated_source.id),
    };
  } catch (error) {
    if (error instanceof StorageError && error.code === 'NOT_FOUND') {
      return {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: `Source not found: ${input.source_id}`,
          cause: error,
        },
      };
    }

    if (error instanceof StorageError) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_FAILED',
          message: error.message,
          cause: error,
        },
      };
    }

    return {
      ok: false,
      error: {
        code: 'UNKNOWN',
        message: 'Failed to approve Source.',
        cause: error,
      },
    };
  }
}

function invalid_state(
  message: string,
  details?: WorkflowError['details'],
): WorkflowResult<ApproveSourceWorkflowData> {
  return {
    ok: false,
    error: {
      code: 'INVALID_STATE',
      message,
      details,
    },
  };
}

function next_actions_for_source(source_id: string): NextAction[] {
  return [
    {
      label: 'Compose note',
      command: `ai-knowledge note compose ${source_id}`,
    },
  ];
}
