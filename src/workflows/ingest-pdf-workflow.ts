import { access } from 'node:fs/promises';
import path from 'node:path';
import { create_slug } from '../domain/slug.js';
import type { Source } from '../domain/source.js';
import type { StorageConfig } from '../storage/config.js';
import { StorageError } from '../storage/errors.js';
import { create_source } from '../storage/source-repo.js';
import { summarize_source, type SourceSummary } from './source-summary.js';
import type { WorkflowResult } from './types.js';
import {
  build_user_import_source,
  create_available_source_id,
  next_actions_for_source,
} from './ingest-source-helpers.js';

export type IngestPdfWorkflowInput = {
  file_path: string;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
  now?: Date;
};

export type IngestPdfWorkflowData = {
  source_id: string;
  source: SourceSummary;
};

export async function ingest_pdf_workflow(
  input: IngestPdfWorkflowInput,
): Promise<WorkflowResult<IngestPdfWorkflowData>> {
  try {
    const resolved_file_path = path.resolve(
      input.cwd ?? process.cwd(),
      input.file_path,
    );
    await access(resolved_file_path);

    if (!resolved_file_path.toLowerCase().endsWith('.pdf')) {
      return invalid_input('PDF import requires a .pdf file.');
    }

    const now = input.now ?? new Date();
    const timestamp = now.toISOString();
    const title = path.basename(
      resolved_file_path,
      path.extname(resolved_file_path),
    );
    const slug = create_slug(title);
    const source_id = await create_available_source_id({
      now,
      slug,
      ingest_type: 'upload_pdf',
      storage_config: input.storage_config,
      cwd: input.cwd,
    });

    const source: Source = build_user_import_source({
      source_id,
      title,
      ingest_type: 'upload_pdf',
      content_type: 'document',
      user_input_type: 'pdf',
      timestamp,
    });

    const created_source = await create_source(
      {
        source,
        raw_file_name: 'original.pdf',
        raw_file_path: resolved_file_path,
      },
      {
        config: input.storage_config,
        cwd: input.cwd,
      },
    );

    return {
      ok: true,
      data: {
        source_id: created_source.id,
        source: summarize_source(created_source),
      },
      next_actions: next_actions_for_source(created_source.id),
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
        message: 'PDF file cannot be read.',
        cause: error,
      },
    };
  }
}

function invalid_input(message: string): WorkflowResult<IngestPdfWorkflowData> {
  return {
    ok: false,
    error: {
      code: 'INVALID_INPUT',
      message,
    },
  };
}
