import { describe, expect, it } from 'vitest';
import { build_index_entry } from '../../src/indexing/build-index-entry.js';
import {
  retrieve_approved_notes,
  retrieve_hybrid_approved_notes,
} from '../../src/retrieval/retrieve-approved-notes.js';
import {
  save_index_entry,
  save_vector_index,
} from '../../src/storage/index-repo.js';
import { create_note } from '../../src/storage/note-repo.js';
import { render_note_markdown } from '../../src/notes/render-markdown.js';
import { create_test_note } from '../note-test-helpers.js';
import { FakeEmbeddingProvider } from '../fake-embedding-provider.js';
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

describe('hybrid approved note retrieval', () => {
  it('combines keyword metadata and vector signals at note level', async () => {
    const cwd = await create_temp_dir();
    const note = approved_note({
      id: 'note_20260514_hybrid-agent',
      title: 'Hybrid Agent Retrieval',
      conclusion: 'Hybrid retrieval combines signals.',
    });
    await create_note({ note, markdown: render_note_markdown(note) }, { cwd });
    await save_index_entry(
      {
        ...build_index_entry(note),
        keywords: ['agent', 'retrieval'],
        tags: ['hybrid'],
        vector_ref: {
          index_id: `vec_${note.id}`,
          path: '2026/05/note_20260514_hybrid-agent.vector.json',
          embedding_model: 'fake-embedding',
          embedding_dimensions: 2,
          chunker_version: 'note-json-v1',
          created_at: '2026-05-14T00:00:00.000Z',
        },
      },
      { cwd },
    );
    await save_vector_index(
      {
        index_id: `vec_${note.id}`,
        note_id: note.id,
        embedding_model: 'fake-embedding',
        embedding_dimensions: 2,
        chunker_version: 'note-json-v1',
        created_at: '2026-05-14T00:00:00.000Z',
        chunks: [
          {
            chunk_id: 'chunk_0001',
            source_field: 'title',
            content_hash: 'abc123',
            text: note.title,
            embedding: [1, 0],
          },
          {
            chunk_id: 'chunk_0002',
            source_field: 'summary',
            content_hash: 'def456',
            text: note.current_understanding,
            embedding: [1, 0],
          },
        ],
      },
      { cwd },
    );

    const results = await retrieve_hybrid_approved_notes({
      cwd,
      question: 'agent retrieval',
      top_k: 5,
      metadata_filter: { boost_tags: ['hybrid'] },
      embedding_provider: new FakeEmbeddingProvider({
        embedding_model: 'fake-embedding',
        embedding_dimensions: 2,
        embeddings: [[1, 0]],
      }),
      include_debug: true,
    });

    expect(results).toHaveLength(1);
    expect(results[0].note.id).toBe(note.id);
    expect(results[0].retrieval.signals.map((signal) => signal.type)).toEqual([
      'keyword',
      'metadata',
      'vector',
    ]);
    expect(results[0].retrieval.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ explanation: 'best chunk chunk_0001' }),
      ]),
    );
  });

  it('filters and boosts by metadata fields', async () => {
    const cwd = await create_temp_dir();
    const first = approved_note({
      id: 'note_20260514_hybrid-first',
      title: 'Hybrid First',
      conclusion: 'First conclusion.',
    });
    const second = approved_note({
      id: 'note_20260514_hybrid-second',
      title: 'Hybrid Second',
      conclusion: 'Second conclusion.',
    });
    await create_note(
      { note: first, markdown: render_note_markdown(first) },
      { cwd },
    );
    await create_note(
      { note: second, markdown: render_note_markdown(second) },
      { cwd },
    );
    await save_index_entry(
      {
        ...build_index_entry(first),
        keywords: ['agent'],
        tags: ['included'],
        related_note_ids: ['note_20260514_related'],
      },
      { cwd },
    );
    await save_index_entry(
      { ...build_index_entry(second), keywords: ['agent'], tags: ['other'] },
      { cwd },
    );

    const results = await retrieve_hybrid_approved_notes({
      cwd,
      question: 'agent',
      top_k: 5,
      metadata_filter: {
        tags: ['included'],
        related_note_ids: ['note_20260514_related'],
        approved_at_from: '2026-05-01T00:00:00.000Z',
        approved_at_to: '2026-05-31T23:59:59.999Z',
        boost_keywords: ['agent'],
      },
    });

    expect(results.map((result) => result.note.id)).toEqual([first.id]);
    expect(results[0].retrieval.signals.map((signal) => signal.type)).toContain(
      'metadata',
    );
  });

  it('continues with keyword results when vector is unavailable', async () => {
    const cwd = await create_temp_dir();
    const note = approved_note({
      id: 'note_20260514_no-vector',
      title: 'No Vector Agent',
      conclusion: 'No vector required.',
    });
    await create_note({ note, markdown: render_note_markdown(note) }, { cwd });
    await save_index_entry(build_index_entry(note), { cwd });

    const results = await retrieve_hybrid_approved_notes({
      cwd,
      question: 'vector agent',
      top_k: 5,
      include_debug: true,
      embedding_provider: new FakeEmbeddingProvider(
        new Error('provider failed'),
      ),
    });

    expect(results).toHaveLength(1);
    expect(results[0].retrieval.signals.map((signal) => signal.type)).toEqual([
      'keyword',
    ]);
    expect(results[0].retrieval.debug.join('\n')).toContain('no vector_ref');
  });

  it('omits vector signal on dimension mismatch', async () => {
    const cwd = await create_temp_dir();
    const note = approved_note({
      id: 'note_20260514_dimension-mismatch',
      title: 'Dimension Mismatch Agent',
      conclusion: 'Dimension mismatch fallback.',
    });
    await create_note({ note, markdown: render_note_markdown(note) }, { cwd });
    await save_index_entry(
      {
        ...build_index_entry(note),
        vector_ref: {
          index_id: `vec_${note.id}`,
          path: '2026/05/note_20260514_dimension-mismatch.vector.json',
          embedding_model: 'fake-embedding',
          embedding_dimensions: 3,
          chunker_version: 'note-json-v1',
          created_at: '2026-05-14T00:00:00.000Z',
        },
      },
      { cwd },
    );
    await save_vector_index(
      {
        index_id: `vec_${note.id}`,
        note_id: note.id,
        embedding_model: 'fake-embedding',
        embedding_dimensions: 3,
        chunker_version: 'note-json-v1',
        created_at: '2026-05-14T00:00:00.000Z',
        chunks: [
          {
            chunk_id: 'chunk_0001',
            source_field: 'title',
            content_hash: 'abc123',
            text: note.title,
            embedding: [1, 0, 0],
          },
        ],
      },
      { cwd },
    );

    const results = await retrieve_hybrid_approved_notes({
      cwd,
      question: 'dimension agent',
      top_k: 5,
      include_debug: true,
      embedding_provider: new FakeEmbeddingProvider({
        embedding_model: 'fake-embedding',
        embedding_dimensions: 2,
        embeddings: [[1, 0]],
      }),
    });

    expect(results).toHaveLength(1);
    expect(
      results[0].retrieval.signals.map((signal) => signal.type),
    ).not.toContain('vector');
    expect(results[0].retrieval.debug.join('\n')).toContain(
      'embedding dimensions mismatch',
    );
  });

  it('sorts by score then approved_at then note id and respects top_k', async () => {
    const cwd = await create_temp_dir();
    const old_note = approved_note({
      id: 'note_20260514_agent-old',
      title: 'Agent Tie',
      conclusion: 'Tie score old.',
    });
    const new_note = {
      ...approved_note({
        id: 'note_20260515_agent-new',
        title: 'Agent Tie',
        conclusion: 'Tie score new.',
      }),
      approved_at: '2026-05-15T00:00:00.000Z',
    };
    await create_note(
      { note: old_note, markdown: render_note_markdown(old_note) },
      { cwd },
    );
    await create_note(
      { note: new_note, markdown: render_note_markdown(new_note) },
      { cwd },
    );
    await save_index_entry(build_index_entry(old_note), { cwd });
    await save_index_entry(build_index_entry(new_note), { cwd });

    const results = await retrieve_hybrid_approved_notes({
      cwd,
      question: 'agent tie',
      top_k: 1,
    });

    expect(results.map((result) => result.note.id)).toEqual([new_note.id]);
  });
});
