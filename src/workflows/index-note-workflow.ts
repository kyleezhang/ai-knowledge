import { build_index_entry } from '../indexing/build-index-entry.js';
import type { IndexEntry } from '../domain/index-entry.js';
import type { StorageConfig } from '../storage/config.js';
import { StorageError } from '../storage/errors.js';
import { save_index_entry } from '../storage/index-repo.js';
import { get_note } from '../storage/note-repo.js';
import type { WorkflowResult } from './types.js';

export type IndexNoteWorkflowInput = {
  note_id: string;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
};

export type IndexNoteWorkflowData = {
  note_id: string;
  index_entry: IndexEntry;
};

export async function index_note_workflow(
  input: IndexNoteWorkflowInput,
): Promise<WorkflowResult<IndexNoteWorkflowData>> {
  const context = { config: input.storage_config, cwd: input.cwd };
  try {
    const note = await get_note(input.note_id, context);
    if (note.status !== 'approved') {
      return {
        ok: false,
        error: {
          code: 'INVALID_STATE',
          message: `Note must be approved before indexing. Current status: ${note.status}`,
        },
      };
    }

    const index_entry = build_index_entry(note);
    await save_index_entry(index_entry, context);

    return {
      ok: true,
      data: {
        note_id: note.id,
        index_entry,
      },
    };
  } catch (error) {
    if (error instanceof StorageError && error.code === 'NOT_FOUND') {
      return {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: `Note not found: ${input.note_id}`,
          cause: error,
        },
      };
    }
    return {
      ok: false,
      error: {
        code: error instanceof StorageError ? 'STORAGE_FAILED' : 'UNKNOWN',
        message:
          error instanceof Error ? error.message : 'Failed to index Note.',
        cause: error,
      },
    };
  }
}
