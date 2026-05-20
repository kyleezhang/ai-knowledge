import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  NoteSchema,
  NoteStatusSchema,
  parse_note,
  type Note,
  type NoteStatus,
} from '../domain/note.js';
import type { StorageConfig } from './config.js';
import { StorageError } from './errors.js';
import { read_json, write_json } from './json-store.js';
import {
  note_dir,
  note_json_path,
  note_markdown_path,
  notes_root,
} from './paths.js';

export type NoteRepoContext = {
  config?: Partial<StorageConfig>;
  cwd?: string;
};

export type NoteListFilter = {
  status?: NoteStatus;
};

export async function create_note(
  input: { note: Note; markdown: string },
  context: NoteRepoContext = {},
): Promise<Note> {
  const note = parse_note(input.note);
  const dir = note_dir(note.id, context);
  if (await exists(dir)) {
    throw new StorageError({
      code: 'ALREADY_EXISTS',
      message: `Note already exists: ${note.id}`,
      path: dir,
    });
  }

  await mkdir(dir, { recursive: true });
  await write_json({
    file_path: note_json_path(note.id, context),
    schema: NoteSchema,
    data: note,
  });
  await writeFile(note_markdown_path(note.id, context), input.markdown, 'utf8');
  return note;
}

export async function get_note(
  note_id: string,
  context: NoteRepoContext = {},
): Promise<Note> {
  const primary_path = note_json_path(note_id, context);
  if (await exists(primary_path)) {
    return parse_note(
      await read_json({ file_path: primary_path, schema: NoteSchema }),
    );
  }

  const fallback_path = await find_note_json(note_id, context);
  if (fallback_path === null) {
    throw new StorageError({
      code: 'NOT_FOUND',
      message: `Note not found: ${note_id}`,
      path: primary_path,
    });
  }

  return parse_note(
    await read_json({ file_path: fallback_path, schema: NoteSchema }),
  );
}

export async function save_note(
  note: Note,
  context: NoteRepoContext = {},
): Promise<void> {
  const parsed_note = parse_note(note);
  await write_json({
    file_path: note_json_path(parsed_note.id, context),
    schema: NoteSchema,
    data: parsed_note,
  });
}

export async function get_note_markdown(
  note_id: string,
  context: NoteRepoContext = {},
): Promise<string> {
  return readFile(note_markdown_path(note_id, context), 'utf8');
}

export async function save_note_markdown(
  note_id: string,
  markdown: string,
  context: NoteRepoContext = {},
): Promise<void> {
  await writeFile(note_markdown_path(note_id, context), markdown, 'utf8');
}

export async function list_notes(
  filter: NoteListFilter = {},
  context: NoteRepoContext = {},
): Promise<Note[]> {
  if (filter.status !== undefined) {
    NoteStatusSchema.parse(filter.status);
  }

  const root = notes_root(context);
  if (!(await exists(root))) {
    return [];
  }

  const files = await find_note_json_files(root);
  const notes = await Promise.all(
    files.map(async (file_path) =>
      parse_note(await read_json({ file_path, schema: NoteSchema })),
    ),
  );

  return notes
    .filter(
      (note) => filter.status === undefined || note.status === filter.status,
    )
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at));
}

export async function note_exists(
  note_id: string,
  context: NoteRepoContext = {},
): Promise<boolean> {
  try {
    await get_note(note_id, context);
    return true;
  } catch {
    return false;
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

async function find_note_json(
  note_id: string,
  context: NoteRepoContext,
): Promise<string | null> {
  const files = await find_note_json_files(notes_root(context));
  return (
    files.find(
      (file_path) => path.basename(path.dirname(file_path)) === note_id,
    ) ?? null
  );
}

async function find_note_json_files(root: string): Promise<string[]> {
  if (!(await exists(root))) {
    return [];
  }

  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entry_path = path.join(root, entry.name);
      if (entry.isDirectory()) {
        return find_note_json_files(entry_path);
      }
      return entry.name === 'note.json' ? [entry_path] : [];
    }),
  );

  return nested.flat();
}
