import { access, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import {
  IndexEntrySchema,
  parse_index_entry,
  type IndexEntry,
} from '../domain/index-entry.js';
import type { StorageConfig } from './config.js';
import { StorageError } from './errors.js';
import { read_json, write_json } from './json-store.js';
import { index_entry_path, index_root } from './paths.js';

export type IndexRepoContext = {
  config?: Partial<StorageConfig>;
  cwd?: string;
};

export async function save_index_entry(
  entry: IndexEntry,
  context: IndexRepoContext = {},
): Promise<void> {
  const parsed = parse_index_entry(entry);
  const file_path = index_entry_path(parsed.note_id, context);
  await mkdir(path.dirname(file_path), { recursive: true });
  await write_json({
    file_path,
    schema: IndexEntrySchema,
    data: parsed,
  });
}

export async function get_index_entry(
  note_id: string,
  context: IndexRepoContext = {},
): Promise<IndexEntry> {
  const file_path = index_entry_path(note_id, context);
  if (!(await exists(file_path))) {
    throw new StorageError({
      code: 'NOT_FOUND',
      message: `Index entry not found: ${note_id}`,
      path: file_path,
    });
  }
  return parse_index_entry(
    await read_json({ file_path, schema: IndexEntrySchema }),
  );
}

export async function list_index_entries(
  context: IndexRepoContext = {},
): Promise<IndexEntry[]> {
  const root = index_root(context);
  if (!(await exists(root))) {
    return [];
  }
  const files = await find_index_files(root);
  const entries = await Promise.all(
    files.map(async (file_path) =>
      parse_index_entry(
        await read_json({ file_path, schema: IndexEntrySchema }),
      ),
    ),
  );
  return entries.sort((left, right) =>
    right.approved_at.localeCompare(left.approved_at),
  );
}

export async function remove_index_entry(
  note_id: string,
  context: IndexRepoContext = {},
): Promise<boolean> {
  const file_path = index_entry_path(note_id, context);
  if (!(await exists(file_path))) {
    return false;
  }

  try {
    await rm(file_path);
    return true;
  } catch (error) {
    throw new StorageError({
      code: 'WRITE_FAILED',
      message: `Failed to remove index entry: ${note_id}`,
      path: file_path,
      cause: error,
    });
  }
}

async function exists(file_path: string): Promise<boolean> {
  try {
    await access(file_path);
    return true;
  } catch {
    return false;
  }
}

async function find_index_files(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entry_path = path.join(root, entry.name);
      if (entry.isDirectory()) {
        return find_index_files(entry_path);
      }
      return entry.name.endsWith('.index.json') ? [entry_path] : [];
    }),
  );
  return nested.flat();
}
