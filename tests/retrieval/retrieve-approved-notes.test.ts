import { describe, expect, it } from 'vitest';
import { build_index_entry } from '../../src/indexing/build-index-entry.js';
import { retrieve_approved_notes } from '../../src/retrieval/retrieve-approved-notes.js';
import { save_index_entry } from '../../src/storage/index-repo.js';
import { create_note } from '../../src/storage/note-repo.js';
import { render_note_markdown } from '../../src/notes/render-markdown.js';
import { create_test_note } from '../note-test-helpers.js';
import { create_temp_dir } from '../source-test-helpers.js';

const passed_quality_checks = {
  status: 'passed',
  template_complete: true,
  source_links_present: true,
  empty_sections: [],
  last_checked_at: '2026-05-14T00:00:00.000Z',
} as const;

function approved_note(input: {
  id: string;
  title: string;
  conclusion: string;
}) {
  return create_test_note({
    id: input.id,
    root_note_id: input.id,
    title: input.title,
    slug: input.title.toLowerCase().replace(/\s+/gu, '-'),
    status: 'approved',
    approved_at: '2026-05-14T00:00:00.000Z',
    conclusions: [input.conclusion],
    quality_checks: { ...passed_quality_checks, empty_sections: [] },
  });
}

describe('retrieve approved notes', () => {
  it('retrieves approved notes by keyword and respects top_k', async () => {
    const cwd = await create_temp_dir();
    const first = approved_note({
      id: 'note_20260514_agent-memory',
      title: 'Agent Memory',
      conclusion: 'Agent memory improves workflows.',
    });
    const second = approved_note({
      id: 'note_20260514_agent-tools',
      title: 'Agent Tools',
      conclusion: 'Agent tools require boundaries.',
    });
    await create_note(
      { note: first, markdown: render_note_markdown(first) },
      { cwd },
    );
    await create_note(
      { note: second, markdown: render_note_markdown(second) },
      { cwd },
    );
    await save_index_entry(build_index_entry(first), { cwd });
    await save_index_entry(build_index_entry(second), { cwd });

    const results = await retrieve_approved_notes({
      question: 'agent memory',
      top_k: 1,
      cwd,
    });

    expect(results).toHaveLength(1);
    expect(results[0].note.id).toBe(first.id);
  });

  it('returns no matches when keywords do not match', async () => {
    const cwd = await create_temp_dir();
    const note = approved_note({
      id: 'note_20260514_agent-memory',
      title: 'Agent Memory',
      conclusion: 'Agent memory improves workflows.',
    });
    await create_note({ note, markdown: render_note_markdown(note) }, { cwd });
    await save_index_entry(build_index_entry(note), { cwd });

    await expect(
      retrieve_approved_notes({
        question: 'database migration',
        top_k: 5,
        cwd,
      }),
    ).resolves.toEqual([]);
  });

  it('skips index entries whose notes are no longer approved', async () => {
    const cwd = await create_temp_dir();
    const archived = approved_note({
      id: 'note_20260514_archived-target',
      title: 'Archived Target',
      conclusion: 'Archived target.',
    });
    const superseded = approved_note({
      id: 'note_20260514_superseded-target',
      title: 'Superseded Target',
      conclusion: 'Superseded target.',
    });
    await create_note(
      {
        note: { ...archived, status: 'archived' },
        markdown: render_note_markdown({ ...archived, status: 'archived' }),
      },
      { cwd },
    );
    await create_note(
      {
        note: {
          ...superseded,
          status: 'superseded',
          superseded_by_note_id: 'note_20260514_new-target',
        },
        markdown: render_note_markdown({
          ...superseded,
          status: 'superseded',
          superseded_by_note_id: 'note_20260514_new-target',
        }),
      },
      { cwd },
    );
    await save_index_entry(build_index_entry(archived), { cwd });
    await save_index_entry(build_index_entry(superseded), { cwd });

    await expect(
      retrieve_approved_notes({ question: 'archived target', top_k: 5, cwd }),
    ).resolves.toEqual([]);
    await expect(
      retrieve_approved_notes({ question: 'superseded target', top_k: 5, cwd }),
    ).resolves.toEqual([]);
  });

  it('skips index entries whose notes cannot be loaded', async () => {
    const cwd = await create_temp_dir();
    const note = approved_note({
      id: 'note_20260514_missing-target',
      title: 'Missing Target',
      conclusion: 'Missing target.',
    });
    await save_index_entry(build_index_entry(note), { cwd });

    await expect(
      retrieve_approved_notes({ question: 'missing target', top_k: 5, cwd }),
    ).resolves.toEqual([]);
  });
});
