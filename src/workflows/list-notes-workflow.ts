import { NoteStatusSchema, type NoteStatus } from '../domain/note.js';
import type { StorageConfig } from '../storage/config.js';
import { StorageError } from '../storage/errors.js';
import { list_notes } from '../storage/note-repo.js';
import { summarize_note, type NoteSummary } from './note-summary.js';
import type { WorkflowResult } from './types.js';

export type ListNotesWorkflowInput = {
  status?: NoteStatus;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
};

export type ListNotesWorkflowData = {
  notes: NoteSummary[];
};

export async function list_notes_workflow(
  input: ListNotesWorkflowInput = {},
): Promise<WorkflowResult<ListNotesWorkflowData>> {
  try {
    if (input.status !== undefined) {
      NoteStatusSchema.parse(input.status);
    }
    const notes = await list_notes(
      { status: input.status },
      { config: input.storage_config, cwd: input.cwd },
    );
    return { ok: true, data: { notes: notes.map(summarize_note) } };
  } catch (error) {
    return {
      ok: false,
      error: {
        code:
          error instanceof StorageError ? 'STORAGE_FAILED' : 'INVALID_INPUT',
        message:
          error instanceof Error ? error.message : 'Failed to list Notes.',
        cause: error,
      },
    };
  }
}
