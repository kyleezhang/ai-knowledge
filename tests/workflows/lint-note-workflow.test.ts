import { describe, expect, it } from 'vitest';
import { default_quality_checks } from '../../src/domain/note.js';
import { render_note_markdown } from '../../src/notes/render-markdown.js';
import {
  create_note,
  get_note,
  save_note_markdown,
} from '../../src/storage/note-repo.js';
import { lint_note_workflow } from '../../src/workflows/lint-note-workflow.js';
import { create_temp_dir } from '../source-test-helpers.js';
import { create_test_note } from '../note-test-helpers.js';

describe('lint note workflow', () => {
  it('passes lint for a complete draft note and writes quality checks', async () => {
    const cwd = await create_temp_dir();
    const note = create_test_note();
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
    await create_note({ note, markdown: render_note_markdown(note) }, { cwd });
    await save_note_markdown(note.id, '# Broken\n', { cwd });

    const result = await lint_note_workflow({ note_id: note.id, cwd });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('QA_FAILED');
  });
});
