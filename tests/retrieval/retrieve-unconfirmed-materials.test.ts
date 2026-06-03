import { describe, expect, it } from 'vitest';
import { create_test_note } from '../note-test-helpers.js';
import {
  create_temp_dir,
  write_markdown_fixture,
} from '../source-test-helpers.js';
import { create_note } from '../../src/storage/note-repo.js';
import { render_note_markdown } from '../../src/notes/render-markdown.js';
import { get_source, save_source } from '../../src/storage/source-repo.js';
import { ingest_markdown_workflow } from '../../src/workflows/ingest-markdown-workflow.js';
import { process_source_workflow } from '../../src/workflows/process-source-workflow.js';
import { retrieve_unconfirmed_materials } from '../../src/retrieval/retrieve-unconfirmed-materials.js';

async function processed_source(cwd: string, content: string) {
  const file_path = await write_markdown_fixture(cwd, 'fallback.md', content);
  const ingest = await ingest_markdown_workflow({
    cwd,
    file_path,
    now: new Date('2026-05-14T00:00:00.000Z'),
  });
  if (!ingest.ok) throw new Error(ingest.error.message);
  const process = await process_source_workflow({
    cwd,
    source_id: ingest.data.source_id,
    now: new Date('2026-05-14T01:00:00.000Z'),
  });
  if (!process.ok) throw new Error(process.error.message);
  return get_source(ingest.data.source_id, { cwd });
}

describe('retrieve unconfirmed materials', () => {
  it('returns no evidence unless explicitly enabled', async () => {
    const cwd = await create_temp_dir();
    await processed_source(
      cwd,
      `# Test Source\n\nFallback topic appears here.\n`,
    );

    await expect(
      retrieve_unconfirmed_materials({
        cwd,
        question: 'fallback topic',
        enabled: false,
      }),
    ).resolves.toEqual([]);
  });

  it('uses processed segments with source trace and excerpt limits', async () => {
    const cwd = await create_temp_dir();
    const source = await processed_source(
      cwd,
      `# Test Source\n\nFallback topic appears here with a very long explanation that should be truncated.\n`,
    );

    const evidence = await retrieve_unconfirmed_materials({
      cwd,
      question: 'fallback topic',
      enabled: true,
      max_excerpt_length: 24,
    });

    expect(evidence).toEqual([
      expect.objectContaining({
        confirmation_status: 'unconfirmed',
        material_type: 'processed_segment',
        source_id: source.id,
        source_title: source.title,
        source_status: 'processed',
        evidence_ref: 'processed/segments.json#seg_0001',
      }),
    ]);
    expect(evidence[0].excerpt.length).toBeLessThanOrEqual(24);
  });

  it('uses draft understanding and discussion summary as labeled fallback evidence', async () => {
    const cwd = await create_temp_dir();
    const source = await processed_source(cwd, `# Test Source\n\nBody text.\n`);
    await save_source(
      {
        ...source,
        status: 'understanding_ready',
        draft_understanding: {
          summary: 'Fallback draft insight.',
          generated_at: '2026-05-14T02:00:00.000Z',
          key_points: ['Draft point about fallback.'],
          uncertainties: ['Draft uncertainty.'],
          discussion_starters: [],
        },
        discussion_summary: {
          ...source.discussion_summary,
          confirmed_points: ['Discussion fallback point.'],
          summary_version: 1,
        },
      },
      { cwd },
    );

    const evidence = await retrieve_unconfirmed_materials({
      cwd,
      question: 'fallback',
      enabled: true,
      max_items: 5,
    });

    expect(evidence.map((item) => item.material_type)).toEqual(
      expect.arrayContaining(['draft_understanding', 'discussion_summary']),
    );
    expect(
      evidence.every((item) => item.confirmation_status === 'unconfirmed'),
    ).toBe(true);
  });

  it('does not use raw artifacts or mutate notes and sources', async () => {
    const cwd = await create_temp_dir();
    const file_path = await write_markdown_fixture(
      cwd,
      'raw-only.md',
      `# Raw Only\n\nrawfallback appears only in raw content.\n`,
    );
    const ingest = await ingest_markdown_workflow({ cwd, file_path });
    if (!ingest.ok) throw new Error(ingest.error.message);
    const note = create_test_note();
    await create_note({ note, markdown: render_note_markdown(note) }, { cwd });
    const before_source = await get_source(ingest.data.source_id, { cwd });

    const evidence = await retrieve_unconfirmed_materials({
      cwd,
      question: 'rawfallback',
      enabled: true,
    });
    const after_source = await get_source(ingest.data.source_id, { cwd });

    expect(evidence).toEqual([]);
    expect(after_source).toEqual(before_source);
  });
});
