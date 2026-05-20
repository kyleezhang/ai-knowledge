import { transition_note } from '../domain/state-machine.js';
import type { StorageConfig } from '../storage/config.js';
import { StorageError } from '../storage/errors.js';
import { get_note, save_note } from '../storage/note-repo.js';
import { summarize_note, type NoteSummary } from './note-summary.js';
import type { NextAction, WorkflowResult } from './types.js';

export type ApproveNoteWorkflowInput = {
  note_id: string;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
  now?: Date;
};

export type ApproveNoteWorkflowData = {
  note_id: string;
  note: NoteSummary;
};

export async function approve_note_workflow(
  input: ApproveNoteWorkflowInput,
): Promise<WorkflowResult<ApproveNoteWorkflowData>> {
  const context = { config: input.storage_config, cwd: input.cwd };
  try {
    const note = await get_note(input.note_id, context);
    if (note.status !== 'draft') {
      return invalid_state(
        `Note must be draft before approval. Current status: ${note.status}`,
      );
    }
    if (note.quality_checks.status !== 'passed') {
      return invalid_state(
        'Note quality_checks must be passed before approval.',
      );
    }

    const timestamp = (input.now ?? new Date()).toISOString();
    const approved_note = {
      ...transition_note(note, 'approved'),
      approved_at: timestamp,
      updated_at: timestamp,
    };
    await save_note(approved_note, context);

    return {
      ok: true,
      data: {
        note_id: approved_note.id,
        note: summarize_note(approved_note),
      },
      next_actions: next_actions_for_note(approved_note.id),
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
          error instanceof Error ? error.message : 'Failed to approve Note.',
        cause: error,
      },
    };
  }
}

function invalid_state(
  message: string,
): WorkflowResult<ApproveNoteWorkflowData> {
  return { ok: false, error: { code: 'INVALID_STATE', message } };
}

function next_actions_for_note(note_id: string): NextAction[] {
  return [
    { label: 'Index note', command: `ai-knowledge note index ${note_id}` },
  ];
}
