import type { Note, NoteStatus } from './note.js';
import type { Source, SourceStatus } from './source.js';

const source_transitions: Record<SourceStatus, readonly SourceStatus[]> = {
  ingested: ['processing', 'archived'],
  processing: ['processed', 'failed'],
  processed: ['understanding_ready', 'failed', 'archived'],
  understanding_ready: ['discussing', 'archived'],
  discussing: ['approved_for_note', 'failed', 'archived'],
  approved_for_note: ['noted', 'archived'],
  noted: ['archived'],
  archived: [],
  failed: ['processing', 'processed', 'archived'],
};

const note_transitions: Record<NoteStatus, readonly NoteStatus[]> = {
  draft: ['approved', 'archived'],
  approved: ['superseded', 'archived'],
  archived: [],
  superseded: [],
};

export function transition_note(note: Note, target_status: NoteStatus): Note {
  const allowed = note_transitions[note.status];
  if (!allowed.includes(target_status)) {
    throw new Error(
      `Invalid note transition: ${note.status} -> ${target_status}`,
    );
  }

  return {
    ...note,
    status: target_status,
  };
}

export function transition_source(
  source: Source,
  target_status: SourceStatus,
): Source {
  const allowed = source_transitions[source.status];
  if (!allowed.includes(target_status)) {
    throw new Error(
      `Invalid source transition: ${source.status} -> ${target_status}`,
    );
  }

  return {
    ...source,
    status: target_status,
  };
}
