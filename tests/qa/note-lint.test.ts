import { describe, expect, it } from 'vitest';
import { render_note_markdown } from '../../src/notes/render-markdown.js';
import { note_lint } from '../../src/qa/note-lint.js';
import { create_test_note } from '../note-test-helpers.js';

describe('note lint', () => {
  it('passes a complete draft note and markdown', () => {
    const note = create_test_note();
    const result = note_lint({
      note,
      markdown: render_note_markdown(note),
      checked_at: '2026-05-14T00:00:00.000Z',
    });

    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([]);
    expect(result.quality_checks).toEqual({
      status: 'passed',
      template_complete: true,
      source_links_present: true,
      empty_sections: [],
      last_checked_at: '2026-05-14T00:00:00.000Z',
    });
  });

  it('fails when source_refs are missing', () => {
    const note = create_test_note({ source_refs: [] });
    const result = note_lint({
      note,
      markdown: render_note_markdown(create_test_note()),
      checked_at: '2026-05-14T00:00:00.000Z',
    });

    expect(result.passed).toBe(false);
    expect(result.failures).toContain('source_refs is required');
    expect(result.quality_checks.source_links_present).toBe(false);
  });

  it('fails when evidence refs are missing or do not use processed segment locators', () => {
    const note = create_test_note({
      source_refs: [
        {
          source_id: 'src_20260514_upload_markdown_test-source',
          source_title: 'Test Source',
          source_url: null,
          evidence_refs: [],
        },
        {
          source_id: 'src_20260514_upload_markdown_test-source',
          source_title: 'Test Source',
          source_url: null,
          evidence_refs: ['processed/segments.json', 'raw/original.md#intro'],
        },
      ],
    });
    const result = note_lint({
      note,
      markdown: render_note_markdown(note),
      checked_at: '2026-05-14T00:00:00.000Z',
    });

    expect(result.passed).toBe(false);
    expect(result.failures).toEqual(
      expect.arrayContaining([
        'source_refs.evidence_refs is required',
        'invalid evidence_ref: processed/segments.json must use processed/segments.json#<segment_id>',
        'invalid evidence_ref: raw/original.md#intro must use processed/segments.json#<segment_id>',
      ]),
    );
  });

  it('fails when conclusions are empty', () => {
    const note = create_test_note({ conclusions: [] });
    const result = note_lint({
      note,
      markdown: render_note_markdown(note),
      checked_at: '2026-05-14T00:00:00.000Z',
    });

    expect(result.failures).toContain('conclusions is required');
  });

  it('fails when why_it_matters is empty', () => {
    const note = create_test_note({ why_it_matters: [] });
    const result = note_lint({
      note,
      markdown: render_note_markdown(note),
      checked_at: '2026-05-14T00:00:00.000Z',
    });

    expect(result.failures).toContain('why_it_matters is required');
  });

  it('fails when approval context is invalid', () => {
    const note = create_test_note({
      approval_context: {
        source_id: '',
        discussion_ref: 'discussion.jsonl',
        approved_from_summary_version: 0,
      },
    });
    const result = note_lint({
      note,
      markdown: render_note_markdown(note),
      checked_at: '2026-05-14T00:00:00.000Z',
    });

    expect(result.failures).toContain('approval_context.source_id is required');
    expect(result.failures).toContain(
      'approval_context.approved_from_summary_version is required',
    );
  });

  it('fails when markdown sections are missing', () => {
    const note = create_test_note();
    const result = note_lint({
      note,
      markdown: '# Missing Template\n',
      checked_at: '2026-05-14T00:00:00.000Z',
    });

    expect(result.passed).toBe(false);
    expect(result.quality_checks.template_complete).toBe(false);
    expect(result.quality_checks.empty_sections).toContain('## 来源概览');
    expect(result.failures).toContain('missing markdown section: ## 来源概览');
  });
});
