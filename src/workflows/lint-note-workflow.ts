import type { StorageConfig } from '../storage/config.js';
import { StorageError } from '../storage/errors.js';
import {
  get_note,
  get_note_markdown,
  save_note,
} from '../storage/note-repo.js';
import { get_source } from '../storage/source-repo.js';
import { read_processed_artifacts } from '../storage/artifact-store.js';
import { note_lint, type NoteLintResult } from '../qa/note-lint.js';
import { summarize_note, type NoteSummary } from './note-summary.js';
import type { NextAction, WorkflowResult } from './types.js';

export type LintNoteWorkflowInput = {
  note_id: string;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
  now?: Date;
};

export type LintNoteWorkflowData = {
  note_id: string;
  note: NoteSummary;
  lint: NoteLintResult;
};

export async function lint_note_workflow(
  input: LintNoteWorkflowInput,
): Promise<WorkflowResult<LintNoteWorkflowData>> {
  const context = { config: input.storage_config, cwd: input.cwd };

  try {
    const note = await get_note(input.note_id, context);
    if (note.status !== 'draft') {
      return {
        ok: false,
        error: {
          code: 'INVALID_STATE',
          message: `Note must be draft before lint. Current status: ${note.status}`,
        },
      };
    }

    const markdown = await get_note_markdown(note.id, context);
    const source = await get_source(note.approval_context.source_id, context);
    const artifacts = await read_processed_artifacts(source, context);
    const lint = note_lint({
      note,
      markdown,
      checked_at: (input.now ?? new Date()).toISOString(),
      source_segments: artifacts.segments,
    });
    const updated_note = {
      ...note,
      quality_checks: lint.quality_checks,
      updated_at: (input.now ?? new Date()).toISOString(),
    };
    await save_note(updated_note, context);

    if (!lint.passed) {
      return {
        ok: false,
        error: {
          code: 'QA_FAILED',
          message: 'Note lint failed.',
          details: { failures: lint.failures },
        },
      };
    }

    return {
      ok: true,
      data: {
        note_id: updated_note.id,
        note: summarize_note(updated_note),
        lint,
      },
      next_actions: next_actions_for_note(updated_note.id),
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
          error instanceof Error ? error.message : 'Failed to lint Note.',
        cause: error,
      },
    };
  }
}

function next_actions_for_note(note_id: string): NextAction[] {
  return [
    {
      label: 'Approve note',
      command: `ai-knowledge note approve ${note_id}`,
    },
  ];
}
