import { access, writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { build_index_entry } from '../../src/indexing/build-index-entry.js';
import {
  get_index_entry,
  get_vector_index,
  list_index_entries,
  remove_index_entry,
  remove_vector_index,
  save_index_entry,
  save_vector_index,
} from '../../src/storage/index-repo.js';
import {
  index_entry_path,
  vector_index_path,
  vector_index_ref_path,
} from '../../src/storage/paths.js';
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

  it('copies related_note_ids from approved note JSON', () => {
    const note = approved_note();
    const entry = build_index_entry({
      ...note,
      related_note_ids: ['note_20260514_related'],
    });

    expect(entry.related_note_ids).toEqual(['note_20260514_related']);
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

  it('removes index entries through storage paths', async () => {
    const cwd = await create_temp_dir();
    const entry = build_index_entry(approved_note());
    await save_index_entry(entry, { cwd });
    const entry_path = index_entry_path(entry.note_id, { cwd });

    await expect(remove_index_entry(entry.note_id, { cwd })).resolves.toBe(
      true,
    );

    await expect(access(entry_path)).rejects.toBeDefined();
    await expect(list_index_entries({ cwd })).resolves.toEqual([]);
  });

  it('saves and reads vector indexes through storage paths', async () => {
    const cwd = await create_temp_dir();
    const vector_index = {
      index_id: 'vec_note_20260514_test-note',
      note_id: 'note_20260514_test-note',
      embedding_model: 'test-embedding',
      embedding_dimensions: 2,
      chunker_version: 'note-json-v1',
      created_at: '2026-05-14T00:00:00.000Z',
      chunks: [
        {
          chunk_id: 'chunk_0001',
          source_field: 'title',
          content_hash: 'abc123',
          text: 'Test Note',
          embedding: [0.1, 0.2],
        },
      ],
    };

    await save_vector_index(vector_index, { cwd });

    expect(vector_index_path(vector_index.note_id, { cwd })).toContain(
      'knowledge/index/2026/05/note_20260514_test-note.vector.json',
    );
    expect(vector_index_ref_path(vector_index.note_id)).toBe(
      '2026/05/note_20260514_test-note.vector.json',
    );
    await expect(
      get_vector_index(vector_index.note_id, { cwd }),
    ).resolves.toEqual(vector_index);
  });

  it('removes vector indexes directly and during index cleanup', async () => {
    const cwd = await create_temp_dir();
    const entry = build_index_entry(approved_note());
    const vector_index = {
      index_id: 'vec_note_20260514_test-note',
      note_id: entry.note_id,
      embedding_model: 'test-embedding',
      embedding_dimensions: 1,
      chunker_version: 'note-json-v1',
      created_at: '2026-05-14T00:00:00.000Z',
      chunks: [
        {
          chunk_id: 'chunk_0001',
          source_field: 'title',
          content_hash: 'abc123',
          text: 'Test Note',
          embedding: [0.1],
        },
      ],
    };
    await save_index_entry(entry, { cwd });
    await save_vector_index(vector_index, { cwd });
    const entry_path = index_entry_path(entry.note_id, { cwd });
    const vector_path = vector_index_path(entry.note_id, { cwd });

    await expect(remove_index_entry(entry.note_id, { cwd })).resolves.toBe(
      true,
    );

    await expect(access(entry_path)).rejects.toBeDefined();
    await expect(access(vector_path)).rejects.toBeDefined();
    await expect(remove_vector_index(entry.note_id, { cwd })).resolves.toBe(
      false,
    );
  });

  it('rejects invalid vector index JSON on read', async () => {
    const cwd = await create_temp_dir();
    const note_id = 'note_20260514_test-note';
    await save_vector_index(
      {
        index_id: 'vec_note_20260514_test-note',
        note_id,
        embedding_model: 'test-embedding',
        embedding_dimensions: 1,
        chunker_version: 'note-json-v1',
        created_at: '2026-05-14T00:00:00.000Z',
        chunks: [
          {
            chunk_id: 'chunk_0001',
            source_field: 'title',
            content_hash: 'abc123',
            text: 'Test Note',
            embedding: [0.1],
          },
        ],
      },
      { cwd },
    );
    await writeFile(
      vector_index_path(note_id, { cwd }),
      '{"invalid": true}',
      'utf8',
    );

    await expect(get_vector_index(note_id, { cwd })).rejects.toBeDefined();
  });

  it('reports missing index entries as not removed', async () => {
    const cwd = await create_temp_dir();

    await expect(
      remove_index_entry('note_20260514_missing-note', { cwd }),
    ).resolves.toBe(false);
  });
});
