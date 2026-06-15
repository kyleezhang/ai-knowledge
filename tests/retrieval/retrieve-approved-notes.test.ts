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
  related_note_ids?: string[];
}) {
  return create_test_note({
    id: input.id,
    root_note_id: input.id,
    title: input.title,
    slug: input.title.toLowerCase().replace(/\s+/gu, '-'),
    status: 'approved',
    approved_at: '2026-05-14T00:00:00.000Z',
    conclusions: [input.conclusion],
    related_note_ids: input.related_note_ids ?? [],
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

  it('expands direct keyword matches with one-hop approved related notes', async () => {
    const cwd = await create_temp_dir();
    const related = approved_note({
      id: 'note_20260514_related-context',
      title: 'Related Context',
      conclusion: 'Related context supplements the direct match.',
    });
    const direct = approved_note({
      id: 'note_20260514_direct-context',
      title: 'Direct Context',
      conclusion: 'Direct context answers the question.',
      related_note_ids: [related.id],
    });
    await create_note(
      { note: direct, markdown: render_note_markdown(direct) },
      { cwd },
    );
    await create_note(
      { note: related, markdown: render_note_markdown(related) },
      { cwd },
    );
    await save_index_entry(build_index_entry(direct), { cwd });
    await save_index_entry(build_index_entry(related), { cwd });

    const results = await retrieve_approved_notes({
      question: 'direct context',
      top_k: 1,
      cwd,
      include_debug: true,
    });

    expect(results.map((result) => result.note.id)).toEqual([
      direct.id,
      related.id,
    ]);
    expect(results[0].retrieval).toMatchObject({ retrieval_role: 'direct' });
    expect(results[1].retrieval).toMatchObject({
      retrieval_role: 'related',
      related_via_note_id: direct.id,
      related_via_title: direct.title,
    });
    expect(results[1].retrieval?.debug.join('\n')).toContain(
      `related via ${direct.id}`,
    );
  });

  it('skips non-approved and missing related notes with debug reasons', async () => {
    const cwd = await create_temp_dir();
    const draft = {
      ...approved_note({
        id: 'note_20260514_draft-related',
        title: 'Draft Related',
        conclusion: 'Draft related must not be used.',
      }),
      status: 'draft' as const,
      approved_at: null,
      quality_checks: {
        ...passed_quality_checks,
        status: 'failed' as const,
        empty_sections: [],
      },
    };
    const approved_related = approved_note({
      id: 'note_20260514_approved-related',
      title: 'Approved Related',
      conclusion: 'Approved related may be used.',
    });
    const direct = approved_note({
      id: 'note_20260514_direct-related-skip',
      title: 'Direct Related Skip',
      conclusion: 'Direct note references mixed related notes.',
      related_note_ids: [
        draft.id,
        'note_20260514_missing-related',
        approved_related.id,
      ],
    });
    await create_note(
      { note: direct, markdown: render_note_markdown(direct) },
      { cwd },
    );
    await create_note(
      { note: draft, markdown: render_note_markdown(draft) },
      {
        cwd,
      },
    );
    await create_note(
      {
        note: approved_related,
        markdown: render_note_markdown(approved_related),
      },
      { cwd },
    );
    await save_index_entry(build_index_entry(direct), { cwd });
    await save_index_entry(build_index_entry(approved_related), { cwd });

    const results = await retrieve_approved_notes({
      question: 'direct related skip',
      top_k: 1,
      cwd,
      include_debug: true,
    });

    expect(results.map((result) => result.note.id)).toEqual([
      direct.id,
      approved_related.id,
    ]);
    const debug = results[0].retrieval?.debug.join('\n') ?? '';
    expect(debug).toContain(`related skipped: ${draft.id} status is draft`);
    expect(debug).toContain(
      'related skipped: note_20260514_missing-related could not be loaded',
    );
  });

  it('dedupes related notes and keeps direct role when a related note is also direct', async () => {
    const cwd = await create_temp_dir();
    const shared = approved_note({
      id: 'note_20260514_shared-agent-context',
      title: 'Shared Agent Context',
      conclusion: 'Shared note also directly matches.',
    });
    const related = approved_note({
      id: 'note_20260514_unique-related',
      title: 'Unique Related',
      conclusion: 'Unique related appears once.',
    });
    const first = approved_note({
      id: 'note_20260514_first-direct-agent',
      title: 'First Direct Agent',
      conclusion: 'First direct note.',
      related_note_ids: [shared.id, related.id],
    });
    const second = approved_note({
      id: 'note_20260514_second-direct-agent',
      title: 'Second Direct Agent',
      conclusion: 'Second direct note.',
      related_note_ids: [related.id],
    });
    for (const note of [first, second, shared, related]) {
      await create_note(
        { note, markdown: render_note_markdown(note) },
        { cwd },
      );
      await save_index_entry(build_index_entry(note), { cwd });
    }

    const results = await retrieve_approved_notes({
      question: 'direct agent shared',
      top_k: 3,
      cwd,
      include_debug: true,
    });

    expect(results.map((result) => result.note.id)).toEqual([
      shared.id,
      first.id,
      second.id,
      related.id,
    ]);
    expect(
      results.filter((result) => result.note.id === shared.id),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.note.id === shared.id)?.retrieval
        ?.retrieval_role,
    ).toBe('direct');
    expect(
      results.filter((result) => result.note.id === related.id),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.note.id === related.id)?.retrieval
        ?.retrieval_role,
    ).toBe('related');
    expect(results[0].retrieval?.debug.join('\n')).toContain(
      `related skipped: ${shared.id} is already a direct match`,
    );
    expect(results[0].retrieval?.debug.join('\n')).toContain(
      `related skipped: ${related.id} is duplicate`,
    );
  });

  it('applies related expansion total and per-direct caps', async () => {
    const cwd = await create_temp_dir();
    const related_a = approved_note({
      id: 'note_20260514_related-cap-a',
      title: 'Related Cap A',
      conclusion: 'First related cap note.',
    });
    const related_b = approved_note({
      id: 'note_20260514_related-cap-b',
      title: 'Related Cap B',
      conclusion: 'Second related cap note.',
    });
    const related_c = approved_note({
      id: 'note_20260514_related-cap-c',
      title: 'Related Cap C',
      conclusion: 'Third related cap note.',
    });
    const direct = approved_note({
      id: 'note_20260514_direct-cap-agent',
      title: 'Direct Cap Agent',
      conclusion: 'Direct note has many related notes.',
      related_note_ids: [related_a.id, related_b.id, related_c.id],
    });
    for (const note of [direct, related_a, related_b, related_c]) {
      await create_note(
        { note, markdown: render_note_markdown(note) },
        { cwd },
      );
      await save_index_entry(build_index_entry(note), { cwd });
    }

    const results = await retrieve_approved_notes({
      question: 'direct cap agent',
      top_k: 1,
      cwd,
      include_debug: true,
      related_context_limit: 2,
      related_per_direct_note_limit: 1,
    });

    expect(results.map((result) => result.note.id)).toEqual([
      direct.id,
      related_a.id,
    ]);
    expect(results[0].retrieval?.debug.join('\n')).toContain(
      `related expansion truncated: 2 related notes skipped for ${direct.id} by per-direct limit 1`,
    );
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

  it('continues with keyword results when configured query provider is missing credentials', async () => {
    const cwd = await create_temp_dir();
    const note = approved_note({
      id: 'note_20260514_missing-provider',
      title: 'Missing Provider Agent',
      conclusion: 'Missing provider fallback.',
    });
    await create_note({ note, markdown: render_note_markdown(note) }, { cwd });
    await save_index_entry(
      {
        ...build_index_entry(note),
        vector_ref: {
          index_id: `vec_${note.id}`,
          path: '2026/05/note_20260514_missing-provider.vector.json',
          embedding_model: 'voyage-4',
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
        embedding_model: 'voyage-4',
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
        ],
      },
      { cwd },
    );

    const previous = process.env.VOYAGE_API_KEY;
    delete process.env.VOYAGE_API_KEY;
    try {
      const results = await retrieve_hybrid_approved_notes({
        cwd,
        question: 'missing provider agent',
        top_k: 5,
        include_debug: true,
      });

      expect(results).toHaveLength(1);
      expect(results[0].retrieval.signals.map((signal) => signal.type)).toEqual(
        ['keyword'],
      );
      expect(results[0].retrieval.debug.join('\n')).toContain(
        'Missing API key environment variable: VOYAGE_API_KEY',
      );
    } finally {
      if (previous === undefined) {
        delete process.env.VOYAGE_API_KEY;
      } else {
        process.env.VOYAGE_API_KEY = previous;
      }
    }
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

  it('expands hybrid direct matches with approved related notes', async () => {
    const cwd = await create_temp_dir();
    const related = approved_note({
      id: 'note_20260514_hybrid-related',
      title: 'Hybrid Related',
      conclusion: 'Hybrid related supplements the direct match.',
    });
    const direct = approved_note({
      id: 'note_20260514_hybrid-direct',
      title: 'Hybrid Direct Agent',
      conclusion: 'Hybrid direct answers the question.',
      related_note_ids: [related.id],
    });
    await create_note(
      { note: direct, markdown: render_note_markdown(direct) },
      { cwd },
    );
    await create_note(
      { note: related, markdown: render_note_markdown(related) },
      { cwd },
    );
    await save_index_entry(build_index_entry(direct), { cwd });
    await save_index_entry(build_index_entry(related), { cwd });

    const results = await retrieve_hybrid_approved_notes({
      cwd,
      question: 'hybrid direct agent',
      top_k: 1,
      include_debug: true,
      embedding_provider: new FakeEmbeddingProvider(
        new Error('provider failed'),
      ),
    });

    expect(results.map((result) => result.note.id)).toEqual([
      direct.id,
      related.id,
    ]);
    expect(results[0].retrieval.retrieval_role).toBe('direct');
    expect(results[1].retrieval).toMatchObject({
      retrieval_role: 'related',
      related_via_note_id: direct.id,
      related_via_title: direct.title,
    });
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
