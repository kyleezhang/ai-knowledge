import type { IndexEntry } from '../domain/index-entry.js';
import type { Note } from '../domain/note.js';

export function build_index_entry(note: Note): IndexEntry {
  if (note.status !== 'approved' || note.approved_at === null) {
    throw new Error('Only approved notes can be indexed.');
  }

  return {
    note_id: note.id,
    title: note.title,
    summary: build_summary(note),
    keywords: build_keywords(note),
    tags: build_tags(note),
    status: 'approved',
    approved_at: note.approved_at,
    related_note_ids: note.related_note_ids,
    vector_ref: null,
  };
}

function build_summary(note: Note): string {
  return note.conclusions[0] ?? note.current_understanding;
}

function build_keywords(note: Note): string[] {
  const text = [
    note.title,
    ...note.conclusions,
    ...note.why_it_matters,
    note.current_understanding,
  ].join(' ');
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^\p{L}\p{N}_-]+/u)
        .map((item) => item.trim())
        .filter((item) => item.length >= 2),
    ),
  ).slice(0, 20);
}

function build_tags(note: Note): string[] {
  return Array.from(
    new Set(
      note.source_refs.flatMap((ref) =>
        ref.evidence_refs.map((item) => item.split('#')[1] ?? item),
      ),
    ),
  ).filter((item) => item.length > 0);
}
