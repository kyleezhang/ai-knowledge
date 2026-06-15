import { describe, expect, it } from 'vitest';
import { default_quality_checks, type Note } from '../../src/domain/note.js';
import { build_index_entry } from '../../src/indexing/build-index-entry.js';
import { render_note_markdown } from '../../src/notes/render-markdown.js';
import {
  get_index_entry,
  get_vector_index,
} from '../../src/storage/index-repo.js';
import {
  create_note,
  get_note,
  get_note_markdown,
} from '../../src/storage/note-repo.js';
import { approve_note_workflow } from '../../src/workflows/approve-note-workflow.js';
import { index_note_workflow } from '../../src/workflows/index-note-workflow.js';
import { create_test_note } from '../note-test-helpers.js';
import { FakeEmbeddingProvider } from '../fake-embedding-provider.js';
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

  it('indexes an approved note with vector metadata when explicitly requested', async () => {
    const cwd = await create_temp_dir();
    const note = create_test_note({
      status: 'approved',
      approved_at: '2026-05-14T01:00:00.000Z',
      quality_checks: passed_quality_checks,
    });
    await create_note({ note, markdown: render_note_markdown(note) }, { cwd });

    const result = await index_note_workflow({
      cwd,
      note_id: note.id,
      include_vector: true,
      embedding_provider: new FakeEmbeddingProvider(),
      now: new Date('2026-05-14T02:00:00.000Z'),
    });
    const index_entry = await get_index_entry(note.id, { cwd });
    const vector_index = await get_vector_index(note.id, { cwd });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.vector_index_ref).toEqual(index_entry.vector_ref);
    expect(index_entry.vector_ref).toMatchObject({
      index_id: `vec_${note.id}`,
      path: '2026/05/note_20260514_test-note.vector.json',
      embedding_model: 'fake-embedding',
      embedding_dimensions: 2,
      created_at: '2026-05-14T02:00:00.000Z',
    });
    expect(vector_index.note_id).toBe(note.id);
    expect(vector_index.chunks.length).toBeGreaterThan(0);
  });

  it('fails vector indexing without configured provider credentials', async () => {
    const cwd = await create_temp_dir();
    const note = create_test_note({
      status: 'approved',
      approved_at: '2026-05-14T01:00:00.000Z',
      quality_checks: passed_quality_checks,
    });
    await create_note({ note, markdown: render_note_markdown(note) }, { cwd });

    const previous = process.env.VOYAGE_API_KEY;
    delete process.env.VOYAGE_API_KEY;
    try {
      const result = await index_note_workflow({
        cwd,
        note_id: note.id,
        include_vector: true,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain(
          'Missing API key environment variable: VOYAGE_API_KEY',
        );
      }
      await expect(get_index_entry(note.id, { cwd })).rejects.toBeDefined();
      await expect(get_vector_index(note.id, { cwd })).rejects.toBeDefined();
    } finally {
      if (previous === undefined) {
        delete process.env.VOYAGE_API_KEY;
      } else {
        process.env.VOYAGE_API_KEY = previous;
      }
    }
  });

  it('does not update vector_ref when vector indexing fails', async () => {
    const cwd = await create_temp_dir();
    const note = create_test_note({
      status: 'approved',
      approved_at: '2026-05-14T01:00:00.000Z',
      quality_checks: passed_quality_checks,
    });
    await create_note({ note, markdown: render_note_markdown(note) }, { cwd });

    const result = await index_note_workflow({
      cwd,
      note_id: note.id,
      include_vector: true,
      embedding_provider: new FakeEmbeddingProvider(
        new Error('provider failed'),
      ),
    });

    expect(result.ok).toBe(false);
    await expect(get_index_entry(note.id, { cwd })).rejects.toBeDefined();
    await expect(get_vector_index(note.id, { cwd })).rejects.toBeDefined();
  });

  it('keeps default P0 indexing vector_ref null', async () => {
    const cwd = await create_temp_dir();
    const note = create_test_note({
      status: 'approved',
      approved_at: '2026-05-14T01:00:00.000Z',
      quality_checks: passed_quality_checks,
    });
    await create_note({ note, markdown: render_note_markdown(note) }, { cwd });

    const result = await index_note_workflow({ cwd, note_id: note.id });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.index_entry.vector_ref).toBeNull();
    expect(result.data.vector_index_ref).toBeNull();
  });

  it('rejects indexing non-approved notes', async () => {
    const cwd = await create_temp_dir();
    const note = create_test_note({ quality_checks: passed_quality_checks });
    const archived = create_test_note({
      id: 'note_20260514_archived-index',
      root_note_id: 'note_20260514_archived-index',
      status: 'archived',
      quality_checks: passed_quality_checks,
    });
    const superseded = create_test_note({
      id: 'note_20260514_superseded-index',
      root_note_id: 'note_20260514_superseded-index',
      status: 'superseded',
      superseded_by_note_id: 'note_20260514_new-index',
      quality_checks: passed_quality_checks,
    });
    await create_note({ note, markdown: render_note_markdown(note) }, { cwd });
    await create_note(
      { note: archived, markdown: render_note_markdown(archived) },
      { cwd },
    );
    await create_note(
      { note: superseded, markdown: render_note_markdown(superseded) },
      { cwd },
    );

    const result = await index_note_workflow({ cwd, note_id: note.id });
    const archived_result = await index_note_workflow({
      cwd,
      note_id: archived.id,
    });
    const superseded_result = await index_note_workflow({
      cwd,
      note_id: superseded.id,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_STATE');
    expect(archived_result.ok).toBe(false);
    if (!archived_result.ok)
      expect(archived_result.error.code).toBe('INVALID_STATE');
    expect(superseded_result.ok).toBe(false);
    if (!superseded_result.ok)
      expect(superseded_result.error.code).toBe('INVALID_STATE');
  });
});
