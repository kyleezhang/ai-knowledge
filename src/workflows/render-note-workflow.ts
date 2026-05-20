import type { StorageConfig } from '../storage/config.js';
import { StorageError } from '../storage/errors.js';
import { get_note, save_note_markdown } from '../storage/note-repo.js';
import { render_note_markdown } from '../notes/render-markdown.js';
import { summarize_note, type NoteSummary } from './note-summary.js';
import type { WorkflowResult } from './types.js';

export type RenderNoteWorkflowInput = {
  note_id: string;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
};

export type RenderNoteWorkflowData = {
  note_id: string;
  note: NoteSummary;
};

export async function render_note_workflow(
  input: RenderNoteWorkflowInput,
): Promise<WorkflowResult<RenderNoteWorkflowData>> {
  const context = { config: input.storage_config, cwd: input.cwd };
  try {
    const note = await get_note(input.note_id, context);
    await save_note_markdown(note.id, render_note_markdown(note), context);
    return {
      ok: true,
      data: {
        note_id: note.id,
        note: summarize_note(note),
      },
    };
  } catch (error) {
    return note_error_result(error, input.note_id);
  }
}

function note_error_result(
  error: unknown,
  note_id: string,
): WorkflowResult<RenderNoteWorkflowData> {
  if (error instanceof StorageError && error.code === 'NOT_FOUND') {
    return {
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: `Note not found: ${note_id}`,
        cause: error,
      },
    };
  }
  return {
    ok: false,
    error: {
      code: error instanceof StorageError ? 'STORAGE_FAILED' : 'UNKNOWN',
      message:
        error instanceof Error ? error.message : 'Failed to render Note.',
      cause: error,
    },
  };
}
