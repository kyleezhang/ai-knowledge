import { transition_note } from '../domain/state-machine.js';
import type { StorageConfig } from '../storage/config.js';
import { StorageError } from '../storage/errors.js';
import { remove_index_entry } from '../storage/index-repo.js';
import { get_note, save_note } from '../storage/note-repo.js';
import { summarize_note, type NoteSummary } from './note-summary.js';
import type { WorkflowResult } from './types.js';

export type ArchiveNoteWorkflowInput = {
  note_id: string;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
  now?: Date;
};

export type ArchiveNoteWorkflowData = {
  note_id: string;
  note: NoteSummary;
  index_entry_removed: boolean;
  vector_index_removed: boolean;
};

export async function archive_note_workflow(
  input: ArchiveNoteWorkflowInput,
): Promise<WorkflowResult<ArchiveNoteWorkflowData>> {
  const context = { config: input.storage_config, cwd: input.cwd };

  try {
    const note = await get_note(input.note_id, context);
    const archived_note = transition_note(note, 'archived');
    const index_entry_removed =
      note.status === 'approved'
        ? await remove_index_entry(note.id, context)
        : false;
    const timestamp = (input.now ?? new Date()).toISOString();
    const updated_note = {
      ...archived_note,
      updated_at: timestamp,
    };

    await save_note(updated_note, context);

    return {
      ok: true,
      data: {
        note_id: updated_note.id,
        note: summarize_note(updated_note),
        index_entry_removed,
        vector_index_removed: index_entry_removed,
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
        code: 'INVALID_STATE',
        message:
          error instanceof Error ? error.message : 'Failed to archive Note.',
        cause: error,
      },
    };
  }
}
