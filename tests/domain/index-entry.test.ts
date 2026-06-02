import { describe, expect, it } from 'vitest';
import {
  assert_note_can_be_vector_indexed,
  parse_index_entry,
  parse_vector_index,
  validate_index_entry,
  validate_vector_index_for_note,
} from '../../src/domain/index-entry.js';
import { create_test_note } from '../note-test-helpers.js';
import { validate_note_invariants } from '../../src/domain/note.js';

describe('IndexEntry domain', () => {
  it('parses valid approved index entries', () => {
    expect(
      parse_index_entry({
        note_id: 'note_20260514_test-note',
        title: 'Test Note',
        summary: 'Summary',
        keywords: ['test'],
        tags: [],
        status: 'approved',
        approved_at: '2026-05-14T00:00:00.000Z',
        related_note_ids: [],
        vector_ref: null,
      }),
    ).toMatchObject({ status: 'approved', vector_ref: null });
  });

  it('parses approved index entries with vector_ref metadata', () => {
    expect(
      parse_index_entry({
        note_id: 'note_20260514_test-note',
        title: 'Test Note',
        summary: 'Summary',
        keywords: ['test'],
        tags: [],
        status: 'approved',
        approved_at: '2026-05-14T00:00:00.000Z',
        related_note_ids: [],
        vector_ref: {
          index_id: 'vec_note_20260514_test-note',
          path: '2026/05/note_20260514_test-note.vector.json',
          embedding_model: 'test-embedding',
          embedding_dimensions: 3,
          chunker_version: 'note-json-v1',
          created_at: '2026-05-14T00:00:00.000Z',
        },
      }),
    ).toMatchObject({
      vector_ref: { embedding_model: 'test-embedding' },
    });
  });

  it('rejects non-approved index status', () => {
    expect(() =>
      parse_index_entry({
        note_id: 'note_20260514_test-note',
        title: 'Test Note',
        summary: 'Summary',
        keywords: [],
        tags: [],
        status: 'draft',
        approved_at: '2026-05-14T00:00:00.000Z',
        related_note_ids: [],
        vector_ref: null,
      }),
    ).toThrow();
  });

  it('requires non-empty approved_at and summary', () => {
    expect(() =>
      validate_index_entry({
        note_id: 'note_20260514_test-note',
        title: 'Test Note',
        summary: '',
        keywords: [],
        tags: [],
        status: 'approved',
        approved_at: '',
        related_note_ids: [],
        vector_ref: null,
      }),
    ).toThrow('index entry must have approved_at');
  });

  it('parses valid vector indexes', () => {
    expect(
      parse_vector_index({
        index_id: 'vec_note_20260514_test-note',
        note_id: 'note_20260514_test-note',
        embedding_model: 'test-embedding',
        embedding_dimensions: 3,
        chunker_version: 'note-json-v1',
        created_at: '2026-05-14T00:00:00.000Z',
        chunks: [
          {
            chunk_id: 'chunk_0001',
            source_field: 'title',
            content_hash: 'abc123',
            text: 'Test Note',
            embedding: [0.1, 0.2, 0.3],
          },
        ],
      }),
    ).toMatchObject({ embedding_dimensions: 3 });
  });

  it('rejects vector indexes with mismatched dimensions', () => {
    expect(() =>
      parse_vector_index({
        index_id: 'vec_note_20260514_test-note',
        note_id: 'note_20260514_test-note',
        embedding_model: 'test-embedding',
        embedding_dimensions: 3,
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
      }),
    ).toThrow('vector index chunk embedding dimension mismatch');
  });

  it('rejects empty vector chunk sets', () => {
    expect(() =>
      parse_vector_index({
        index_id: 'vec_note_20260514_test-note',
        note_id: 'note_20260514_test-note',
        embedding_model: 'test-embedding',
        embedding_dimensions: 3,
        chunker_version: 'note-json-v1',
        created_at: '2026-05-14T00:00:00.000Z',
        chunks: [],
      }),
    ).toThrow('vector index must have chunks');
  });

  it('allows only approved notes for vector indexing', () => {
    const approved_note = {
      ...create_test_note(),
      status: 'approved' as const,
      approved_at: '2026-05-14T00:00:00.000Z',
      quality_checks: {
        status: 'passed' as const,
        template_complete: true,
        source_links_present: true,
        empty_sections: [],
        last_checked_at: '2026-05-14T00:00:00.000Z',
      },
    };

    expect(() =>
      assert_note_can_be_vector_indexed(approved_note),
    ).not.toThrow();
    expect(() =>
      assert_note_can_be_vector_indexed({ ...approved_note, status: 'draft' }),
    ).toThrow('Note must be approved before vector indexing');
    expect(() =>
      assert_note_can_be_vector_indexed({
        ...approved_note,
        status: 'archived',
      }),
    ).toThrow('Note must be approved before vector indexing');
    expect(() =>
      assert_note_can_be_vector_indexed({
        ...approved_note,
        status: 'superseded',
        superseded_by_note_id: 'note_20260515_next-note',
      }),
    ).toThrow('Note must be approved before vector indexing');
  });

  it('validates vector index belongs to the approved note', () => {
    const note = {
      ...create_test_note(),
      status: 'approved' as const,
      approved_at: '2026-05-14T00:00:00.000Z',
      quality_checks: {
        status: 'passed' as const,
        template_complete: true,
        source_links_present: true,
        empty_sections: [],
        last_checked_at: '2026-05-14T00:00:00.000Z',
      },
    };

    expect(() =>
      validate_vector_index_for_note(
        {
          index_id: 'vec_note_20260514_other-note',
          note_id: 'note_20260514_other-note',
          embedding_model: 'test-embedding',
          embedding_dimensions: 1,
          chunker_version: 'note-json-v1',
          created_at: '2026-05-14T00:00:00.000Z',
          chunks: [
            {
              chunk_id: 'chunk_0001',
              source_field: 'title',
              content_hash: 'abc123',
              text: 'Other',
              embedding: [0.1],
            },
          ],
        },
        note,
      ),
    ).toThrow('vector index note_id must match note id');
  });

  it('requires approved notes to have approved_at and passed quality checks', () => {
    expect(() =>
      validate_note_invariants({ ...create_test_note(), status: 'approved' }),
    ).toThrow('approved note must have approved_at');
    expect(() =>
      validate_note_invariants({
        ...create_test_note(),
        status: 'approved',
        approved_at: '2026-05-14T00:00:00.000Z',
      }),
    ).toThrow('approved note must pass quality_checks');
  });
});
