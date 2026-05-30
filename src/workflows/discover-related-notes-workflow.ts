import type { Note } from '../domain/note.js';
import {
  parse_related_note_candidate,
  type RelatedNoteCandidate,
} from '../domain/related-notes.js';
import type { StorageConfig } from '../storage/config.js';
import { StorageError } from '../storage/errors.js';
import { get_note, list_notes } from '../storage/note-repo.js';
import type { WorkflowResult } from './types.js';

export type DiscoverRelatedNotesWorkflowInput = {
  note_id?: string;
  source_text?: string;
  exclude_note_ids?: string[];
  limit?: number;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
};

export type DiscoverRelatedNotesWorkflowData = {
  candidates: RelatedNoteCandidate[];
};

export async function discover_related_notes_workflow(
  input: DiscoverRelatedNotesWorkflowInput,
): Promise<WorkflowResult<DiscoverRelatedNotesWorkflowData>> {
  const context = { config: input.storage_config, cwd: input.cwd };

  try {
    const target_text = await resolve_target_text(input, context);
    const target_keywords = extract_keywords(target_text);
    const excluded = new Set(input.exclude_note_ids ?? []);
    if (input.note_id !== undefined) {
      excluded.add(input.note_id);
    }

    const notes = await list_notes({ status: 'approved' }, context);
    const candidates = notes
      .filter((note) => !excluded.has(note.id))
      .map((note) => build_candidate(note, target_keywords))
      .filter(
        (candidate): candidate is RelatedNoteCandidate => candidate !== null,
      )
      .sort((left, right) => left.note_id.localeCompare(right.note_id))
      .slice(0, input.limit ?? 5);

    return { ok: true, data: { candidates } };
  } catch (error) {
    if (error instanceof StorageError && error.code === 'NOT_FOUND') {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: error.message, cause: error },
      };
    }

    return {
      ok: false,
      error: {
        code:
          error instanceof StorageError ? 'STORAGE_FAILED' : 'INVALID_INPUT',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to discover related notes.',
        cause: error,
      },
    };
  }
}

async function resolve_target_text(
  input: DiscoverRelatedNotesWorkflowInput,
  context: { config?: Partial<StorageConfig>; cwd?: string },
): Promise<string> {
  if (input.source_text !== undefined) {
    return input.source_text;
  }

  if (input.note_id !== undefined) {
    return note_text(await get_note(input.note_id, context));
  }

  throw new Error('Related note discovery requires note_id or source_text.');
}

function build_candidate(
  note: Note,
  target_keywords: Set<string>,
): RelatedNoteCandidate | null {
  const overlap = [...extract_keywords(note_text(note))]
    .filter((keyword) => target_keywords.has(keyword))
    .slice(0, 5);

  if (overlap.length === 0) {
    return null;
  }

  return parse_related_note_candidate({
    note_id: note.id,
    title: note.title,
    reason: `Shares approved note keywords: ${overlap.join(', ')}`,
    status: 'pending',
  });
}

function note_text(note: Note): string {
  return [
    note.title,
    ...note.conclusions,
    ...note.why_it_matters,
    note.current_understanding,
    ...note.open_questions,
  ].join(' ');
}

function extract_keywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}_-]+/u)
      .map((item) => item.trim())
      .filter((item) => item.length >= 3),
  );
}
