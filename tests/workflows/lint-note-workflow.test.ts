import { describe, expect, it } from 'vitest';
import { default_quality_checks, type Note } from '../../src/domain/note.js';
import { render_note_markdown } from '../../src/notes/render-markdown.js';
import { write_processed_artifacts } from '../../src/storage/artifact-store.js';
import {
  create_note,
  get_note,
  save_note_markdown,
} from '../../src/storage/note-repo.js';
import { create_source } from '../../src/storage/source-repo.js';
import { lint_note_workflow } from '../../src/workflows/lint-note-workflow.js';
import { create_temp_dir, create_test_source } from '../source-test-helpers.js';
import { create_test_note } from '../note-test-helpers.js';

describe('lint note workflow', () => {
  it('passes lint for a complete draft note and writes quality checks', async () => {
    const cwd = await create_temp_dir();
    const note = create_test_note();
    await create_lint_source(cwd, note);
    await create_note({ note, markdown: render_note_markdown(note) }, { cwd });

    const result = await lint_note_workflow({
      note_id: note.id,
      cwd,
      now: new Date('2026-05-14T00:00:00.000Z'),
    });
    const updated = await get_note(note.id, { cwd });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(updated.quality_checks.status).toBe('passed');
    expect(result.next_actions).toEqual([
      {
        label: 'Approve note',
        command: `ai-knowledge note approve ${note.id}`,
      },
    ]);
  });

  it('fails lint and writes failed quality checks', async () => {
    const cwd = await create_temp_dir();
    const note = create_test_note({ conclusions: [] });
    await create_lint_source(cwd, note);
    await create_note({ note, markdown: '# Missing Template\n' }, { cwd });

    const result = await lint_note_workflow({ note_id: note.id, cwd });
    const updated = await get_note(note.id, { cwd });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('QA_FAILED');
    expect(result.error.details).toEqual({
      failures: expect.arrayContaining(['conclusions is required']),
    });
    expect(updated.status).toBe('draft');
    expect(updated.quality_checks.status).toBe('failed');
    expect(updated.quality_checks.empty_sections).toContain('## 来源概览');
  });

  it('rejects non-draft notes without updating quality checks', async () => {
    const cwd = await create_temp_dir();
    const note = create_test_note({
      status: 'archived',
      quality_checks: default_quality_checks,
    });
    await create_note({ note, markdown: render_note_markdown(note) }, { cwd });

    const result = await lint_note_workflow({ note_id: note.id, cwd });
    const updated = await get_note(note.id, { cwd });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_STATE');
    expect(updated.quality_checks).toEqual(default_quality_checks);
  });

  it('fails when markdown template sections are missing', async () => {
    const cwd = await create_temp_dir();
    const note = create_test_note();
    await create_lint_source(cwd, note);
    await create_note({ note, markdown: render_note_markdown(note) }, { cwd });
    await save_note_markdown(note.id, '# Broken\n', { cwd });

    const result = await lint_note_workflow({ note_id: note.id, cwd });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('QA_FAILED');
  });

  it('fails when evidence refs are invalid or missing from processed segments', async () => {
    const cwd = await create_temp_dir();
    const note = create_test_note({
      source_refs: [
        {
          source_id: 'src_20260514_upload_markdown_test-source',
          source_title: 'Test Source',
          source_url: null,
          evidence_refs: [
            'raw/original.md#intro',
            'processed/clean_text.md',
            'processed/segments.json#seg_9999',
          ],
        },
      ],
    });
    await create_lint_source(cwd, note);
    await create_note({ note, markdown: render_note_markdown(note) }, { cwd });

    const result = await lint_note_workflow({ note_id: note.id, cwd });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({
      failures: expect.arrayContaining([
        'invalid evidence_ref: raw/original.md#intro must use processed/segments.json#<segment_id>',
        'invalid evidence_ref: processed/clean_text.md must use processed/segments.json#<segment_id>',
        'evidence_ref does not exist in processed segments: processed/segments.json#seg_9999',
      ]),
    });
  });
});

async function create_lint_source(cwd: string, note: Note): Promise<void> {
  const source = create_test_source({
    id: note.approval_context.source_id,
    status: 'processed',
    processing_artifacts: {
      clean_text: 'processed/clean_text.md',
      segments: 'processed/segments.json',
      metadata: 'processed/metadata.json',
    },
  });
  await create_source(
    { source, raw_content: '# Test Source\n\nBody text.\n' },
    { cwd },
  );
  await write_processed_artifacts(
    {
      source,
      clean_text: '# Test Source\n\nBody text.\n',
      segments: [
        {
          id: 'seg_0001',
          order: 1,
          heading_path: ['Test Source'],
          text: 'Body text.',
          locator: {
            ref: 'processed/segments.json#seg_0001',
            source_kind: 'markdown',
            position: 1,
            heading_path: ['Test Source'],
          },
        },
      ],
      metadata: {
        title: 'Test Source',
        headings: [{ level: 1, title: 'Test Source' }],
        links: [],
        segment_count: 1,
        processed_at: '2026-05-14T00:00:00.000Z',
      },
    },
    { cwd },
  );
}
