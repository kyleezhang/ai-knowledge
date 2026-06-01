import { transition_source } from '../domain/state-machine.js';
import type { StorageConfig } from '../storage/config.js';
import { StorageError } from '../storage/errors.js';
import { get_source, save_source } from '../storage/source-repo.js';
import { summarize_source, type SourceSummary } from './source-summary.js';
import type { WorkflowResult } from './types.js';

export type ArchiveSourceWorkflowInput = {
  source_id: string;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
  now?: Date;
};

export type ArchiveSourceWorkflowData = {
  source_id: string;
  source: SourceSummary;
};

export async function archive_source_workflow(
  input: ArchiveSourceWorkflowInput,
): Promise<WorkflowResult<ArchiveSourceWorkflowData>> {
  const context = { config: input.storage_config, cwd: input.cwd };

  try {
    const source = await get_source(input.source_id, context);
    const timestamp = (input.now ?? new Date()).toISOString();
    const archived_source = {
      ...transition_source(source, 'archived'),
      updated_at: timestamp,
    };

    await save_source(archived_source, context);

    return {
      ok: true,
      data: {
        source_id: archived_source.id,
        source: summarize_source(archived_source),
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
        code: 'INVALID_STATE',
        message:
          error instanceof Error ? error.message : 'Failed to archive Source.',
        cause: error,
      },
    };
  }
}
