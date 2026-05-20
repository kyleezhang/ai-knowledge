import { default_quality_checks, type Note } from '../src/domain/note.js';

export function create_test_note(overrides: Partial<Note> = {}): Note {
  const base: Note = {
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

  return {
    ...base,
    ...overrides,
    approval_context: {
      ...base.approval_context,
      ...overrides.approval_context,
    },
    quality_checks: {
      ...base.quality_checks,
      ...overrides.quality_checks,
    },
    render_metadata: {
      ...base.render_metadata,
      ...overrides.render_metadata,
    },
  };
}
