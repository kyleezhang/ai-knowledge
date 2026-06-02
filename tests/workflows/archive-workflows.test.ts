import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { build_index_entry } from '../../src/indexing/build-index-entry.js';
import { render_note_markdown } from '../../src/notes/render-markdown.js';
import { retrieve_approved_notes } from '../../src/retrieval/retrieve-approved-notes.js';
import {
  save_index_entry,
  save_vector_index,
} from '../../src/storage/index-repo.js';
import {
  create_note,
  get_note,
  get_note_markdown,
} from '../../src/storage/note-repo.js';
import { get_source, save_source } from '../../src/storage/source-repo.js';
import { archive_note_workflow } from '../../src/workflows/archive-note-workflow.js';
import { vector_index_path } from '../../src/storage/paths.js';
import { archive_source_workflow } from '../../src/workflows/archive-source-workflow.js';
import { ingest_markdown_workflow } from '../../src/workflows/ingest-markdown-workflow.js';
import { process_source_workflow } from '../../src/workflows/process-source-workflow.js';
import { create_test_note } from '../note-test-helpers.js';
import {
  create_temp_dir,
  write_markdown_fixture,
} from '../source-test-helpers.js';

const passed_quality_checks = {
  status: 'passed' as const,
  template_complete: true,
  source_links_present: true,
  empty_sections: [],
  last_checked_at: '2026-05-14T00:00:00.000Z',
};

describe('archive workflows', () => {
  it('archives a Source while preserving artifacts and linked Notes', async () => {
    const cwd = await create_temp_dir();
    const file_path = await write_markdown_fixture(cwd, 'archive.md');
    const ingest = await ingest_markdown_workflow({
      file_path,
      cwd,
      now: new Date('2026-05-14T00:00:00.000Z'),
    });
    if (!ingest.ok) throw new Error(ingest.error.message);
    const process = await process_source_workflow({
      cwd,
      source_id: ingest.data.source_id,
      now: new Date('2026-05-14T01:00:00.000Z'),
    });
    if (!process.ok) throw new Error(process.error.message);
    const linked_note = create_test_note({
      id: 'note_20260514_linked-note',
      root_note_id: 'note_20260514_linked-note',
    });
    await create_note(
      { note: linked_note, markdown: render_note_markdown(linked_note) },
      { cwd },
    );
    const source = await get_source(ingest.data.source_id, { cwd });
    await save_source({ ...source, note_ids: [linked_note.id] }, { cwd });

    const result = await archive_source_workflow({
      cwd,
      source_id: ingest.data.source_id,
      now: new Date('2026-05-14T02:00:00.000Z'),
    });
    const archived_source = await get_source(ingest.data.source_id, { cwd });
    const reloaded_note = await get_note(linked_note.id, { cwd });
    const source_dir = path.join(
      cwd,
      'knowledge',
      'sources',
      '2026',
      '05',
      ingest.data.source_id,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.source.status).toBe('archived');
    expect(archived_source.status).toBe('archived');
    expect(archived_source.note_ids).toEqual([linked_note.id]);
    expect(reloaded_note.status).toBe('draft');
    await expect(
      access(path.join(source_dir, 'source.json')),
    ).resolves.toBeUndefined();
    await expect(
      access(path.join(source_dir, 'discussion.jsonl')),
    ).resolves.toBeUndefined();
    await expect(
      access(path.join(source_dir, 'raw', 'original.md')),
    ).resolves.toBeUndefined();
    await expect(
      access(path.join(source_dir, 'processed', 'segments.json')),
    ).resolves.toBeUndefined();
  });

  it('rejects Source archive for processing and missing Sources', async () => {
    const cwd = await create_temp_dir();
    const file_path = await write_markdown_fixture(cwd, 'processing.md');
    const ingest = await ingest_markdown_workflow({
      file_path,
      cwd,
      now: new Date('2026-05-14T00:00:00.000Z'),
    });
    if (!ingest.ok) throw new Error(ingest.error.message);
    const source = await get_source(ingest.data.source_id, { cwd });
    await save_source({ ...source, status: 'processing' }, { cwd });

    const processing = await archive_source_workflow({
      cwd,
      source_id: ingest.data.source_id,
    });
    const missing = await archive_source_workflow({
      cwd,
      source_id: 'src_20260514_upload_markdown_missing',
    });

    expect(processing.ok).toBe(false);
    if (!processing.ok) expect(processing.error.code).toBe('INVALID_STATE');
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('NOT_FOUND');
  });

  it('archives an approved Note and removes it from main retrieval', async () => {
    const cwd = await create_temp_dir();
    const note = create_test_note({
      status: 'approved',
      approved_at: '2026-05-14T01:00:00.000Z',
      quality_checks: passed_quality_checks,
    });
    const markdown = render_note_markdown(note);
    await create_note({ note, markdown }, { cwd });
    await save_index_entry(build_index_entry(note), { cwd });
    await save_vector_index(
      {
        index_id: `vec_${note.id}`,
        note_id: note.id,
        embedding_model: 'fake-embedding',
        embedding_dimensions: 1,
        chunker_version: 'note-json-v1',
        created_at: '2026-05-14T01:30:00.000Z',
        chunks: [
          {
            chunk_id: 'chunk_0001',
            source_field: 'title',
            content_hash: 'abc123',
            text: note.title,
            embedding: [0.1],
          },
        ],
      },
      { cwd },
    );
    const vector_path = vector_index_path(note.id, { cwd });

    const result = await archive_note_workflow({
      cwd,
      note_id: note.id,
      now: new Date('2026-05-14T02:00:00.000Z'),
    });
    const archived_note = await get_note(note.id, { cwd });
    const archived_markdown = await get_note_markdown(note.id, { cwd });
    const matches = await retrieve_approved_notes({
      cwd,
      question: 'confirmed conclusion',
      top_k: 5,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.index_entry_removed).toBe(true);
    expect(result.data.vector_index_removed).toBe(true);
    expect(archived_note.status).toBe('archived');
    expect(archived_note.updated_at).toBe('2026-05-14T02:00:00.000Z');
    expect(archived_markdown).toBe(markdown);
    expect(matches).toEqual([]);
    await expect(access(vector_path)).rejects.toBeDefined();
    await expect(
      readdir(path.join(cwd, 'knowledge', 'index', '2026', '05')),
    ).resolves.toEqual([]);
  });

  it('archives a draft Note without requiring an index entry', async () => {
    const cwd = await create_temp_dir();
    const note = create_test_note();
    const markdown = render_note_markdown(note);
    await create_note({ note, markdown }, { cwd });

    const result = await archive_note_workflow({
      cwd,
      note_id: note.id,
      now: new Date('2026-05-14T02:00:00.000Z'),
    });
    const archived_note = await get_note(note.id, { cwd });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.index_entry_removed).toBe(false);
    expect(archived_note.status).toBe('archived');
    await expect(get_note_markdown(note.id, { cwd })).resolves.toBe(markdown);
  });

  it('rejects Note archive for missing and non-archivable Notes', async () => {
    const cwd = await create_temp_dir();
    const archived = create_test_note({ status: 'archived' });
    await create_note(
      { note: archived, markdown: render_note_markdown(archived) },
      { cwd },
    );

    const repeated = await archive_note_workflow({ cwd, note_id: archived.id });
    const missing = await archive_note_workflow({
      cwd,
      note_id: 'note_20260514_missing-note',
    });

    expect(repeated.ok).toBe(false);
    if (!repeated.ok) expect(repeated.error.code).toBe('INVALID_STATE');
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('NOT_FOUND');
    await expect(
      readFile(
        path.join(
          cwd,
          'knowledge',
          'notes',
          '2026',
          '05',
          archived.id,
          'note.json',
        ),
        'utf8',
      ),
    ).resolves.toContain('archived');
  });
});
