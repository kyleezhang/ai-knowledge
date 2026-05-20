import type { IndexEntry } from '../domain/index-entry.js';
import type { Note } from '../domain/note.js';
import type { StorageConfig } from '../storage/config.js';
import { list_index_entries } from '../storage/index-repo.js';
import { get_note } from '../storage/note-repo.js';

export type RetrievedApprovedNote = {
  entry: IndexEntry;
  note: Note;
  score: number;
};

export type RetrieveApprovedNotesInput = {
  question: string;
  top_k: number;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
};

export async function retrieve_approved_notes(
  input: RetrieveApprovedNotesInput,
): Promise<RetrievedApprovedNote[]> {
  const context = { config: input.storage_config, cwd: input.cwd };
  const terms = tokenize(input.question);
  const entries = await list_index_entries(context);
  const scored = entries
    .filter((entry) => entry.status === 'approved')
    .map((entry) => ({ entry, score: score_entry(entry, terms) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, input.top_k);

  const loaded = await Promise.all(
    scored.map(async (item) => {
      try {
        const note = await get_note(item.entry.note_id, context);
        return note.status === 'approved' ? { ...item, note } : null;
      } catch {
        return null;
      }
    }),
  );

  return loaded.filter((item): item is RetrievedApprovedNote => item !== null);
}

function score_entry(entry: IndexEntry, terms: string[]): number {
  const haystack = [
    entry.title,
    entry.summary,
    ...entry.keywords,
    ...entry.tags,
  ]
    .join(' ')
    .toLowerCase();
  return terms.reduce(
    (score, term) => score + (haystack.includes(term) ? 1 : 0),
    0,
  );
}

function tokenize(input: string): string[] {
  return Array.from(
    new Set(
      input
        .toLowerCase()
        .split(/[^\p{L}\p{N}_-]+/u)
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  );
}
