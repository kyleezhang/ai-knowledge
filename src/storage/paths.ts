import path from 'node:path';
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

export function sources_root(context: StoragePathContext = {}): string {
  return path.join(knowledge_dir(context), 'sources');
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

export function source_raw_path(
  source_id: string,
  context: StoragePathContext = {},
): string {
  return path.join(source_dir(source_id, context), 'raw', 'original.md');
}

export function source_processed_dir(
  source_id: string,
  context: StoragePathContext = {},
): string {
  return path.join(source_dir(source_id, context), 'processed');
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
