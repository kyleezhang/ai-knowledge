import type { Note } from '../domain/note.js';

export type NoteSummary = {
  id: string;
  title: string;
  status: Note['status'];
  updated_at: string;
  conclusions: string[];
  source_refs: Note['source_refs'];
  related_note_ids: string[];
  quality_checks: Note['quality_checks'];
};

export function summarize_note(note: Note): NoteSummary {
  return {
    id: note.id,
    title: note.title,
    status: note.status,
    updated_at: note.updated_at,
    conclusions: note.conclusions,
    source_refs: note.source_refs,
    related_note_ids: note.related_note_ids,
    quality_checks: note.quality_checks,
  };
}
