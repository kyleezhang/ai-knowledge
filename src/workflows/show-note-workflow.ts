import type { StorageConfig } from '../storage/config.js';
import { StorageError } from '../storage/errors.js';
import { get_note } from '../storage/note-repo.js';
import { summarize_note, type NoteSummary } from './note-summary.js';
import type { WorkflowResult } from './types.js';

export type ShowNoteWorkflowInput = {
  note_id: string;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
};

export type ShowNoteWorkflowData = {
  note: NoteSummary;
};

export async function show_note_workflow(
  input: ShowNoteWorkflowInput,
): Promise<WorkflowResult<ShowNoteWorkflowData>> {
  try {
    const note = await get_note(input.note_id, {
      config: input.storage_config,
      cwd: input.cwd,
    });
    return { ok: true, data: { note: summarize_note(note) } };
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
          error instanceof Error ? error.message : 'Failed to show Note.',
        cause: error,
      },
    };
  }
}
