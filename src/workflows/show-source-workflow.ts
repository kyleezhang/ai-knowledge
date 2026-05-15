import type { StorageConfig } from '../storage/config.js';
import { StorageError } from '../storage/errors.js';
import { get_source } from '../storage/source-repo.js';
import { summarize_source, type SourceSummary } from './source-summary.js';
import type { WorkflowResult } from './types.js';

export type ShowSourceWorkflowInput = {
  source_id: string;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
};

export type ShowSourceWorkflowData = {
  source: SourceSummary;
};

export async function show_source_workflow(
  input: ShowSourceWorkflowInput,
): Promise<WorkflowResult<ShowSourceWorkflowData>> {
  try {
    const source = await get_source(input.source_id, {
      config: input.storage_config,
      cwd: input.cwd,
    });

    return {
      ok: true,
      data: {
        source: summarize_source(source),
      },
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
        message: 'Failed to show Source.',
        cause: error,
      },
    };
  }
}
