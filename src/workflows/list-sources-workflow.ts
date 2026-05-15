import { SourceStatusSchema, type SourceStatus } from '../domain/source.js';
import type { StorageConfig } from '../storage/config.js';
import { StorageError } from '../storage/errors.js';
import { list_sources } from '../storage/source-repo.js';
import { summarize_source, type SourceSummary } from './source-summary.js';
import type { WorkflowResult } from './types.js';

export type ListSourcesWorkflowInput = {
  status?: SourceStatus;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
};

export type ListSourcesWorkflowData = {
  sources: SourceSummary[];
};

export async function list_sources_workflow(
  input: ListSourcesWorkflowInput = {},
): Promise<WorkflowResult<ListSourcesWorkflowData>> {
  try {
    if (input.status !== undefined) {
      SourceStatusSchema.parse(input.status);
    }

    const sources = await list_sources(
      { status: input.status },
      { config: input.storage_config, cwd: input.cwd },
    );

    return {
      ok: true,
      data: {
        sources: sources.map(summarize_source),
      },
    };
  } catch (error) {
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
        code: 'INVALID_INPUT',
        message: 'Invalid source list input.',
        cause: error,
      },
    };
  }
}
