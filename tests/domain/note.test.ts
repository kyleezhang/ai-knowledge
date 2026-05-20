import { describe, expect, it } from 'vitest';
import { create_note_id } from '../../src/domain/ids.js';
import {
  default_quality_checks,
  parse_note,
  validate_note_invariants,
  type Note,
} from '../../src/domain/note.js';
import { NoteCandidateSchema } from '../../src/agents/schemas.js';

const draft_note: Note = {
  id: 'note_20260514_test-note',
  title: 'Test Note',
  slug: 'test-note',
  status: 'draft',
  version: 1,
  root_note_id: 'note_20260514_test-note',
  supersedes_note_id: null,
  superseded_by_note_id: null,
  created_at: '2026-05-14T00:00:00.000Z',
  updated_at: '2026-05-14T00:00:00.000Z',
  approved_at: null,
  conclusions: ['Confirmed conclusion'],
  why_it_matters: ['It matters.'],
  current_understanding: 'Current understanding.',
  open_questions: [],
  related_note_ids: [],
  source_refs: [
    {
      source_id: 'src_20260514_upload_markdown_test-source',
      source_title: 'Test Source',
      source_url: null,
      evidence_refs: ['processed/segments.json#seg_0001'],
    },
  ],
  approval_context: {
    source_id: 'src_20260514_upload_markdown_test-source',
    discussion_ref: 'discussion.jsonl',
    approved_from_summary_version: 1,
  },
  render_metadata: {
    markdown_template_version: 'v1',
  },
  quality_checks: default_quality_checks,
};

describe('Note domain', () => {
  it('creates note ids', () => {
    expect(
      create_note_id({
        date: new Date('2026-05-14T00:00:00.000Z'),
        slug: 'test-note',
      }),
    ).toBe('note_20260514_test-note');
  });

  it('parses a draft note with default quality checks', () => {
    expect(parse_note(draft_note)).toEqual(draft_note);
    expect(draft_note.quality_checks.status).toBe('failed');
  });

  it('rejects notes without source refs', () => {
    expect(() =>
      validate_note_invariants({ ...draft_note, source_refs: [] }),
    ).toThrow('note must have source_refs');
  });

  it('requires approved notes to pass quality checks', () => {
    expect(() =>
      validate_note_invariants({
        ...draft_note,
        status: 'approved',
        approved_at: '2026-05-14T00:00:00.000Z',
      }),
    ).toThrow('approved note must pass quality_checks');
  });

  it('parses note candidates without system fields', () => {
    const candidate = NoteCandidateSchema.parse({
      title: 'Test Note',
      conclusions: ['Confirmed conclusion'],
      why_it_matters: ['It matters.'],
      current_understanding: 'Current understanding.',
      open_questions: [],
      related_note_ids: [],
      source_refs: draft_note.source_refs,
    });

    expect(candidate.title).toBe('Test Note');
  });

  it('rejects note candidates with invalid field types', () => {
    expect(() =>
      NoteCandidateSchema.parse({
        title: 'Test Note',
        conclusions: 'Confirmed conclusion',
        why_it_matters: [],
        current_understanding: 'Current understanding.',
        open_questions: [],
        related_note_ids: [],
        source_refs: draft_note.source_refs,
      }),
    ).toThrow();
  });

  it('can check conclusions against confirmed points', () => {
    const confirmed_points = ['Confirmed conclusion'];
    const candidate = NoteCandidateSchema.parse({
      title: 'Test Note',
      conclusions: ['Confirmed conclusion'],
      why_it_matters: ['It matters.'],
      current_understanding: 'Current understanding.',
      open_questions: [],
      related_note_ids: [],
      source_refs: draft_note.source_refs,
    });

    expect(
      candidate.conclusions.every((item) => confirmed_points.includes(item)),
    ).toBe(true);
  });
});
