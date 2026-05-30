import { create_slug } from '../domain/slug.js';
import type { Source } from '../domain/source.js';
import type { StorageConfig } from '../storage/config.js';
import { StorageError } from '../storage/errors.js';
import { create_source } from '../storage/source-repo.js';
import {
  read_feishu_doc_with_lark_cli,
  type FeishuDocReader,
} from './feishu-doc-reader.js';
import {
  build_user_import_source,
  create_available_source_id,
  next_actions_for_source,
} from './ingest-source-helpers.js';
import { summarize_source, type SourceSummary } from './source-summary.js';
import type { WorkflowResult } from './types.js';

export type IngestFeishuDocWorkflowInput = {
  doc_url_or_token: string;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
  now?: Date;
  read_feishu_doc?: FeishuDocReader;
};

export type IngestFeishuDocWorkflowData = {
  source_id: string;
  source: SourceSummary;
};

export async function ingest_feishu_doc_workflow(
  input: IngestFeishuDocWorkflowInput,
): Promise<WorkflowResult<IngestFeishuDocWorkflowData>> {
  const original_input = input.doc_url_or_token.trim();
  if (original_input.length === 0) {
    return invalid_input('Feishu Doc import requires a document URL or token.');
  }

  const read_feishu_doc =
    input.read_feishu_doc ?? read_feishu_doc_with_lark_cli;
  let doc;
  try {
    doc = await read_feishu_doc({ doc_url_or_token: original_input });
  } catch (error) {
    return invalid_input(
      'Feishu Doc import failed because the document could not be read.',
      error,
    );
  }

  if (doc.markdown.trim().length === 0) {
    return invalid_input(
      'Feishu Doc import requires non-empty document Markdown.',
    );
  }

  try {
    const now = input.now ?? new Date();
    const timestamp = now.toISOString();
    const title = doc.title.trim() || original_input;
    const slug = create_slug(title);
    const source_id = await create_available_source_id({
      now,
      slug,
      ingest_type: 'feishu_doc',
      storage_config: input.storage_config,
      cwd: input.cwd,
    });

    const source: Source = build_user_import_source({
      source_id,
      title,
      ingest_type: 'feishu_doc',
      content_type: 'document',
      user_input_type: 'feishu_doc',
      timestamp,
      metadata: {
        feishu_doc: {
          original_input,
          title,
          document_type: doc.document_type,
          imported_at: timestamp,
        },
      },
    });

    const created_source = await create_source(
      {
        source,
        raw_artifacts: [
          { file_name: 'original.md', content: doc.markdown },
          {
            file_name: 'feishu-doc.json',
            content: `${JSON.stringify(doc.raw_snapshot, null, 2)}\n`,
          },
        ],
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

    return invalid_input('Feishu Doc import failed.', error);
  }
}

function invalid_input(
  message: string,
  cause?: unknown,
): WorkflowResult<IngestFeishuDocWorkflowData> {
  return {
    ok: false,
    error: {
      code: 'INVALID_INPUT',
      message,
      cause,
    },
  };
}
