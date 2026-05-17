import { transition_source } from '../domain/state-machine.js';
import type { Source } from '../domain/source.js';
import { parse_source } from '../domain/source.js';
import { process_markdown } from '../processing/markdown-processor.js';
import type { MarkdownProcessingResult } from '../processing/markdown-processor.js';
import {
  read_raw_original_markdown,
  write_processed_artifacts,
  type ProcessedArtifactPaths,
} from '../storage/artifact-store.js';
import type { StorageConfig } from '../storage/config.js';
import { StorageError } from '../storage/errors.js';
import { get_source, save_source } from '../storage/source-repo.js';
import { summarize_source, type SourceSummary } from './source-summary.js';
import type { NextAction, WorkflowResult } from './types.js';

export type ProcessSourceWorkflowInput = {
  source_id: string;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
  now?: Date;
  processor?: (input: {
    raw_markdown: string;
    source_title: string;
    processed_at: string;
  }) => MarkdownProcessingResult;
  write_artifacts?: (input: {
    source: Source;
    clean_text: string;
    segments: unknown;
    metadata: unknown;
  }) => Promise<ProcessedArtifactPaths>;
};

export type ProcessSourceWorkflowData = {
  source_id: string;
  source: SourceSummary;
};

export async function process_source_workflow(
  input: ProcessSourceWorkflowInput,
): Promise<WorkflowResult<ProcessSourceWorkflowData>> {
  const context = { config: input.storage_config, cwd: input.cwd };
  let source: Source;

  try {
    source = await get_source(input.source_id, context);
  } catch (error) {
    return storage_error_result(error);
  }

  if (source.status !== 'ingested') {
    return {
      ok: false,
      error: {
        code: 'INVALID_STATE',
        message: `Source must be ingested before processing. Current status: ${source.status}`,
      },
    };
  }

  const now = input.now ?? new Date();
  const timestamp = now.toISOString();

  try {
    source = parse_source({
      ...transition_source(source, 'processing'),
      updated_at: timestamp,
    });
    await save_source(source, context);

    const raw_markdown = await read_raw_original_markdown(source.id, context);
    const processor = input.processor ?? process_markdown;
    const processed = processor({
      raw_markdown,
      source_title: source.title,
      processed_at: timestamp,
    });
    const write_artifacts =
      input.write_artifacts ??
      ((artifact_input) => write_processed_artifacts(artifact_input, context));
    const artifact_paths = await write_artifacts({
      source,
      clean_text: processed.clean_text,
      segments: processed.segments,
      metadata: processed.metadata,
    });

    source = parse_source({
      ...transition_source(
        {
          ...source,
          processing_artifacts: artifact_paths,
          last_error: undefined,
          updated_at: timestamp,
        },
        'processed',
      ),
      processing_artifacts: artifact_paths,
      last_error: undefined,
      updated_at: timestamp,
    });
    await save_source(source, context);

    return {
      ok: true,
      data: {
        source_id: source.id,
        source: summarize_source(source),
      },
      next_actions: next_actions_for_source(source.id),
    };
  } catch (error) {
    const failed_source = parse_source({
      ...transition_source(source, 'failed'),
      updated_at: timestamp,
      last_error: {
        stage: 'processing',
        message: error instanceof Error ? error.message : 'Processing failed.',
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
            'Processing failed and Source failure state could not be saved.',
          cause: save_error,
        },
      };
    }

    return {
      ok: false,
      error: {
        code:
          error instanceof StorageError
            ? 'STORAGE_FAILED'
            : 'PROCESSING_FAILED',
        message: error instanceof Error ? error.message : 'Processing failed.',
        cause: error,
      },
    };
  }
}

function storage_error_result(
  error: unknown,
): WorkflowResult<ProcessSourceWorkflowData> {
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
      label: 'Understand source',
      command: `ai-knowledge source understand ${source_id}`,
    },
  ];
}
