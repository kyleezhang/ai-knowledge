import { describe, expect, it } from 'vitest';
import {
  parse_index_entry,
  validate_index_entry,
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
