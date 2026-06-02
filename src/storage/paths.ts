import path from 'node:path';
import type { SourceIngestType } from '../domain/source.js';
import { format_local_year_month } from '../domain/time.js';
import { resolve_knowledge_dir, resolve_storage_config } from './config.js';
import { StorageError } from './errors.js';

export type StoragePathContext = {
  config?: Parameters<typeof resolve_storage_config>[0];
  cwd?: string;
};

export function knowledge_dir(context: StoragePathContext = {}): string {
  return resolve_knowledge_dir(
    resolve_storage_config(context.config),
    context.cwd,
  );
}

export function candidates_root(context: StoragePathContext = {}): string {
  return path.join(knowledge_dir(context), 'candidates');
}

export function sources_root(context: StoragePathContext = {}): string {
  return path.join(knowledge_dir(context), 'sources');
}

export function notes_root(context: StoragePathContext = {}): string {
  return path.join(knowledge_dir(context), 'notes');
}

export function index_root(context: StoragePathContext = {}): string {
  return path.join(knowledge_dir(context), 'index');
}

export function candidate_json_path(
  candidate_id: string,
  context: StoragePathContext = {},
): string {
  const { year, month } = candidate_year_month(candidate_id);
  return path.join(
    candidates_root(context),
    year,
    month,
    `${candidate_id}.json`,
  );
}

export function index_entry_path(
  note_id: string,
  context: StoragePathContext = {},
): string {
  const { year, month } = note_year_month(note_id);
  return path.join(index_root(context), year, month, `${note_id}.index.json`);
}

export function vector_index_path(
  note_id: string,
  context: StoragePathContext = {},
): string {
  const { year, month } = note_year_month(note_id);
  return path.join(index_root(context), year, month, `${note_id}.vector.json`);
}

export function vector_index_ref_path(note_id: string): string {
  const { year, month } = note_year_month(note_id);
  return path.posix.join(year, month, `${note_id}.vector.json`);
}

export function note_dir(
  note_id: string,
  context: StoragePathContext = {},
): string {
  const { year, month } = note_year_month(note_id);
  return path.join(notes_root(context), year, month, note_id);
}

export function note_json_path(
  note_id: string,
  context: StoragePathContext = {},
): string {
  return path.join(note_dir(note_id, context), 'note.json');
}

export function note_markdown_path(
  note_id: string,
  context: StoragePathContext = {},
): string {
  return path.join(note_dir(note_id, context), 'note.md');
}

export function source_dir(
  source_id: string,
  context: StoragePathContext = {},
): string {
  const { year, month } = source_year_month(source_id);
  return path.join(sources_root(context), year, month, source_id);
}

export function source_json_path(
  source_id: string,
  context: StoragePathContext = {},
): string {
  return path.join(source_dir(source_id, context), 'source.json');
}

export function source_discussion_path(
  source_id: string,
  context: StoragePathContext = {},
): string {
  return path.join(source_dir(source_id, context), 'discussion.jsonl');
}

export function source_raw_dir(
  source_id: string,
  context: StoragePathContext = {},
): string {
  return path.join(source_dir(source_id, context), 'raw');
}

export function source_raw_path(
  source_id: string,
  raw_file_name: string,
  context: StoragePathContext = {},
): string {
  return path.join(source_raw_dir(source_id, context), raw_file_name);
}

export function source_raw_markdown_path(
  source_id: string,
  context: StoragePathContext = {},
): string {
  return source_raw_path(source_id, 'original.md', context);
}

export function source_raw_pdf_path(
  source_id: string,
  context: StoragePathContext = {},
): string {
  return source_raw_path(source_id, 'original.pdf', context);
}

export function source_raw_html_path(
  source_id: string,
  context: StoragePathContext = {},
): string {
  return source_raw_path(source_id, 'fetched.html', context);
}

export function source_raw_feishu_doc_snapshot_path(
  source_id: string,
  context: StoragePathContext = {},
): string {
  return source_raw_path(source_id, 'feishu-doc.json', context);
}

export function source_raw_file_name_for_ingest_type(
  ingest_type: SourceIngestType,
): string {
  switch (ingest_type) {
    case 'upload_markdown':
      return 'original.md';
    case 'upload_pdf':
      return 'original.pdf';
    case 'input_url':
      return 'fetched.html';
    case 'feishu_doc':
      return 'original.md';
    case 'candidate_selected':
      return 'original.md';
    default:
      throw new StorageError({
        code: 'INVALID_PATH',
        message: `No raw artifact file name defined for ingest_type: ${ingest_type}`,
      });
  }
}

export function source_processed_dir(
  source_id: string,
  context: StoragePathContext = {},
): string {
  return path.join(source_dir(source_id, context), 'processed');
}

export function candidate_year_month(candidate_id: string): {
  year: string;
  month: string;
} {
  const match = /^cand_(\d{4})(\d{2})\d{2}_/.exec(candidate_id);
  if (match === null) {
    throw new StorageError({
      code: 'INVALID_PATH',
      message: `Invalid candidate id: ${candidate_id}`,
    });
  }

  return {
    year: match[1],
    month: match[2],
  };
}

export function note_year_month(note_id: string): {
  year: string;
  month: string;
} {
  const match = /^note_(\d{4})(\d{2})\d{2}_/.exec(note_id);
  if (match === null) {
    throw new StorageError({
      code: 'INVALID_PATH',
      message: `Invalid note id: ${note_id}`,
    });
  }

  return {
    year: match[1],
    month: match[2],
  };
}

export function source_year_month(source_id: string): {
  year: string;
  month: string;
} {
  const match = /^src_(\d{4})(\d{2})\d{2}_/.exec(source_id);
  if (match === null) {
    throw new StorageError({
      code: 'INVALID_PATH',
      message: `Invalid source id: ${source_id}`,
    });
  }

  return {
    year: match[1],
    month: match[2],
  };
}

export function source_parent_dir_for_date(
  date: Date,
  context: StoragePathContext = {},
): string {
  const { year, month } = format_local_year_month(date);
  return path.join(sources_root(context), year, month);
}
