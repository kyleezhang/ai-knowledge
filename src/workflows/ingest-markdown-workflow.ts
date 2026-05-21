import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { create_slug } from '../domain/slug.js';
import type { Source } from '../domain/source.js';
import type { StorageConfig } from '../storage/config.js';
import { StorageError } from '../storage/errors.js';
import { create_source } from '../storage/source-repo.js';
import type { NextAction, WorkflowResult } from './types.js';
import { summarize_source, type SourceSummary } from './source-summary.js';
import {
  build_user_import_source,
  create_available_source_id,
  next_actions_for_source,
} from './ingest-source-helpers.js';

export type IngestMarkdownWorkflowInput = {
  file_path: string;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
  now?: Date;
};

export type IngestMarkdownWorkflowData = {
  source_id: string;
  source: SourceSummary;
};

export async function ingest_markdown_workflow(
  input: IngestMarkdownWorkflowInput,
): Promise<WorkflowResult<IngestMarkdownWorkflowData>> {
  try {
    const resolved_file_path = path.resolve(
      input.cwd ?? process.cwd(),
      input.file_path,
    );
    await access(resolved_file_path);

    if (!resolved_file_path.toLowerCase().endsWith('.md')) {
      return invalid_input('Markdown import requires a .md file.');
    }

    const raw = await readFile(resolved_file_path, 'utf8');
    if (raw.trim().length === 0) {
      return invalid_input('Markdown import requires a non-empty file.');
    }

    const now = input.now ?? new Date();
    const timestamp = now.toISOString();
    const title = extract_markdown_title(raw, resolved_file_path);
    const slug = create_slug(title);
    const source_id = await create_available_source_id({
      now,
      slug,
      ingest_type: 'upload_markdown',
      storage_config: input.storage_config,
      cwd: input.cwd,
    });

    const source: Source = build_user_import_source({
      source_id,
      title,
      ingest_type: 'upload_markdown',
      content_type: 'document',
      user_input_type: 'markdown',
      timestamp,
    });

    const created_source = await create_source(
      {
        source,
        raw_file_name: 'original.md',
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
        message: 'Markdown file cannot be read.',
        cause: error,
      },
    };
  }
}

function invalid_input(
  message: string,
): WorkflowResult<IngestMarkdownWorkflowData> {
  return {
    ok: false,
    error: {
      code: 'INVALID_INPUT',
      message,
    },
  };
}

function extract_markdown_title(raw: string, file_path: string): string {
  const frontmatter_title =
    /^---\s*\n[\s\S]*?^title:\s*(.+?)\s*$[\s\S]*?^---\s*$/mu.exec(raw);
  if (frontmatter_title !== null) {
    return strip_quotes(frontmatter_title[1].trim());
  }

  const h1 = /^#\s+(.+?)\s*$/mu.exec(raw);
  if (h1 !== null) {
    return h1[1].trim();
  }

  return path.basename(file_path, path.extname(file_path));
}

function strip_quotes(value: string): string {
  return value.replace(/^['"]|['"]$/gu, '');
}

export function next_actions_for_ingested_markdown_source(
  source_id: string,
): NextAction[] {
  return next_actions_for_source(source_id);
}
