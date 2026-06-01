import { describe, expect, it } from 'vitest';
import { create_note_id } from '../../src/domain/ids.js';
import {
  default_quality_checks,
  parse_note,
  validate_note_invariants,
  type Note,
} from '../../src/domain/note.js';
import { NoteCandidateSchema } from '../../src/agents/schemas.js';
import { transition_note } from '../../src/domain/state-machine.js';

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

  it('allows draft and approved Notes to archive through the state machine', () => {
    const approved = parse_note({
      ...draft_note,
      status: 'approved',
      approved_at: '2026-05-14T00:00:00.000Z',
      quality_checks: {
        ...default_quality_checks,
        status: 'passed',
        template_complete: true,
        source_links_present: true,
      },
    });

    expect(transition_note(draft_note, 'archived').status).toBe('archived');
    expect(transition_note(approved, 'archived').status).toBe('archived');
  });

  it('rejects archiving archived and superseded Notes', () => {
    const archived = parse_note({ ...draft_note, status: 'archived' });
    const superseded = parse_note({
      ...draft_note,
      status: 'superseded',
      superseded_by_note_id: 'note_20260514_new-note',
    });

    expect(() => transition_note(archived, 'archived')).toThrow(
      'Invalid note transition: archived -> archived',
    );
    expect(() => transition_note(superseded, 'archived')).toThrow(
      'Invalid note transition: superseded -> archived',
    );
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

  it('validates version-chain invariants', () => {
    const version_two = parse_note({
      ...draft_note,
      id: 'note_20260514_test-note-v2',
      version: 2,
      root_note_id: draft_note.id,
      supersedes_note_id: draft_note.id,
    });

    expect(version_two.version).toBe(2);
    expect(() =>
      parse_note({ ...draft_note, supersedes_note_id: 'note_20260514_old' }),
    ).toThrow('v1 note must not supersede another note');
    expect(() =>
      parse_note({
        ...draft_note,
        id: 'note_20260514_bad-v2',
        version: 2,
        root_note_id: 'note_20260514_bad-v2',
        supersedes_note_id: draft_note.id,
      }),
    ).toThrow('versioned note root_note_id must differ from id');
    expect(() =>
      parse_note({
        ...draft_note,
        id: 'note_20260514_bad-v2',
        version: 2,
        root_note_id: draft_note.id,
      }),
    ).toThrow('versioned note must have supersedes_note_id');
    expect(() =>
      parse_note({ ...draft_note, superseded_by_note_id: draft_note.id }),
    ).toThrow('note must not be superseded by itself');
  });

  it('allows only approved Notes to transition to superseded', () => {
    const approved = parse_note({
      ...draft_note,
      status: 'approved',
      approved_at: '2026-05-14T00:00:00.000Z',
      quality_checks: {
        ...default_quality_checks,
        status: 'passed',
        template_complete: true,
        source_links_present: true,
      },
    });

    expect(transition_note(approved, 'superseded').status).toBe('superseded');
    expect(() => transition_note(draft_note, 'superseded')).toThrow(
      'Invalid note transition: draft -> superseded',
    );
    expect(() =>
      transition_note(
        parse_note({ ...draft_note, status: 'archived' }),
        'superseded',
      ),
    ).toThrow('Invalid note transition: archived -> superseded');
    expect(() =>
      transition_note(
        parse_note({
          ...draft_note,
          status: 'superseded',
          superseded_by_note_id: 'note_20260514_next-note',
        }),
        'superseded',
      ),
    ).toThrow('Invalid note transition: superseded -> superseded');
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
