import { describe, expect, it } from 'vitest';
import { default_quality_checks, type Note } from '../../src/domain/note.js';
import { build_index_entry } from '../../src/indexing/build-index-entry.js';
import { render_note_markdown } from '../../src/notes/render-markdown.js';
import { get_index_entry } from '../../src/storage/index-repo.js';
import {
  create_note,
  get_note,
  get_note_markdown,
} from '../../src/storage/note-repo.js';
import { approve_note_workflow } from '../../src/workflows/approve-note-workflow.js';
import { index_note_workflow } from '../../src/workflows/index-note-workflow.js';
import { create_test_note } from '../note-test-helpers.js';
import { create_temp_dir } from '../source-test-helpers.js';

const passed_quality_checks: Note['quality_checks'] = {
  status: 'passed',
  template_complete: true,
  source_links_present: true,
  empty_sections: [],
  last_checked_at: '2026-05-14T00:00:00.000Z',
};

describe('approve and index note workflows', () => {
  it('approves a draft note that passed lint', async () => {
    const cwd = await create_temp_dir();
    const note = create_test_note({ quality_checks: passed_quality_checks });
    await create_note({ note, markdown: render_note_markdown(note) }, { cwd });

    const result = await approve_note_workflow({
      cwd,
      note_id: note.id,
      now: new Date('2026-05-14T01:00:00.000Z'),
    });
    const approved = await get_note(note.id, { cwd });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(approved.status).toBe('approved');
    expect(approved.approved_at).toBe('2026-05-14T01:00:00.000Z');
    expect(result.next_actions).toEqual([
      { label: 'Index note', command: `ai-knowledge note index ${note.id}` },
    ]);
  });

  it('rejects approve for non-draft or failed quality checks', async () => {
    const cwd = await create_temp_dir();
    const archived = create_test_note({
      id: 'note_20260514_archived',
      root_note_id: 'note_20260514_archived',
      status: 'archived',
    });
    const failed = create_test_note({
      id: 'note_20260514_failed',
      root_note_id: 'note_20260514_failed',
      quality_checks: default_quality_checks,
    });
    await create_note(
      { note: archived, markdown: render_note_markdown(archived) },
      { cwd },
    );
    await create_note(
      { note: failed, markdown: render_note_markdown(failed) },
      { cwd },
    );

    const archived_result = await approve_note_workflow({
      cwd,
      note_id: archived.id,
    });
    const failed_result = await approve_note_workflow({
      cwd,
      note_id: failed.id,
    });

    expect(archived_result.ok).toBe(false);
    expect(failed_result.ok).toBe(false);
  });

  it('indexes an approved note without modifying note content', async () => {
    const cwd = await create_temp_dir();
    const note = create_test_note({
      status: 'approved',
      approved_at: '2026-05-14T01:00:00.000Z',
      quality_checks: passed_quality_checks,
    });
    const markdown = render_note_markdown(note);
    await create_note({ note, markdown }, { cwd });

    const result = await index_note_workflow({ cwd, note_id: note.id });
    const reloaded = await get_note(note.id, { cwd });
    const reloaded_markdown = await get_note_markdown(note.id, { cwd });
    const index_entry = await get_index_entry(note.id, { cwd });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(index_entry).toEqual(build_index_entry(note));
    expect(reloaded).toEqual(note);
    expect(reloaded_markdown).toBe(markdown);
  });

  it('rejects indexing non-approved notes', async () => {
    const cwd = await create_temp_dir();
    const note = create_test_note({ quality_checks: passed_quality_checks });
    await create_note({ note, markdown: render_note_markdown(note) }, { cwd });

    const result = await index_note_workflow({ cwd, note_id: note.id });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_STATE');
  });
});
