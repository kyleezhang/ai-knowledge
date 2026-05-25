import { describe, expect, it } from 'vitest';
import { build_index_entry } from '../../src/indexing/build-index-entry.js';
import {
  get_index_entry,
  list_index_entries,
  save_index_entry,
} from '../../src/storage/index-repo.js';
import { index_entry_path } from '../../src/storage/paths.js';
import { create_temp_dir } from '../source-test-helpers.js';
import { create_test_note } from '../note-test-helpers.js';

function approved_note() {
  return create_test_note({
    status: 'approved',
    approved_at: '2026-05-14T00:00:00.000Z',
    quality_checks: {
      status: 'passed',
      template_complete: true,
      source_links_present: true,
      empty_sections: [],
      last_checked_at: '2026-05-14T00:00:00.000Z',
    },
  });
}

describe('index repo', () => {
  it('builds P0 index entries with null vector_ref', () => {
    const entry = build_index_entry(approved_note());

    expect(entry.status).toBe('approved');
    expect(entry.vector_ref).toBeNull();
    expect(entry.note_id).toBe('note_20260514_test-note');
    expect(entry.summary).toBe('Confirmed conclusion');
    expect(entry.tags).toEqual(['seg_0001']);
  });

  it('rejects indexing non-approved notes', () => {
    expect(() => build_index_entry(create_test_note())).toThrow(
      'Only approved notes can be indexed.',
    );
  });

  it('saves, reads, and lists index entries', async () => {
    const cwd = await create_temp_dir();
    const entry = build_index_entry(approved_note());

    await save_index_entry(entry, { cwd });

    expect(index_entry_path(entry.note_id, { cwd })).toContain(
      'knowledge/index/2026/05/note_20260514_test-note.index.json',
    );
    await expect(get_index_entry(entry.note_id, { cwd })).resolves.toEqual(
      entry,
    );
    await expect(list_index_entries({ cwd })).resolves.toEqual([entry]);
  });
});
