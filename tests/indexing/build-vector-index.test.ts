import { describe, expect, it } from 'vitest';
import {
  build_note_vector_chunks,
  build_vector_index,
} from '../../src/indexing/build-vector-index.js';
import { FakeEmbeddingProvider } from '../fake-embedding-provider.js';
import { create_test_note } from '../note-test-helpers.js';

function approved_note() {
  return create_test_note({
    status: 'approved',
    approved_at: '2026-05-14T00:00:00.000Z',
    quality_checks: {
      status: 'passed',
      template_complete: true,
      source_links_present: true,
      empty_sections: [],
      last_checked_at: '2026-05-14T00:00:00.000Z',
    },
  });
}

describe('build vector index', () => {
  it('builds stable chunks from approved note json fields', () => {
    const chunks = build_note_vector_chunks(approved_note());

    expect(chunks.map((chunk) => chunk.source_field)).toEqual([
      'title',
      'current_understanding',
      'conclusions.0',
      'why_it_matters.0',
    ]);
    expect(chunks[0]).toMatchObject({
      chunk_id: 'chunk_0001',
      text: 'Test Note',
    });
    expect(chunks[0].content_hash).toHaveLength(64);
  });

  it('rejects empty chunk sets', () => {
    const note = approved_note();

    expect(() =>
      build_vector_index({
        note,
        chunks: [],
        embeddings: [],
        metadata: {
          embedding_model: 'fake-embedding',
          embedding_dimensions: 2,
        },
        created_at: '2026-05-14T00:00:00.000Z',
      }),
    ).toThrow('vector index must have chunks');
  });

  it('rejects embedding count mismatches', () => {
    const note = approved_note();
    const chunks = build_note_vector_chunks(note);

    expect(() =>
      build_vector_index({
        note,
        chunks,
        embeddings: [[0.1, 0.2]],
        metadata: {
          embedding_model: 'fake-embedding',
          embedding_dimensions: 2,
        },
        created_at: '2026-05-14T00:00:00.000Z',
      }),
    ).toThrow('embedding count must match chunk count');
  });

  it('builds vector index using fake provider output', async () => {
    const note = approved_note();
    const chunks = build_note_vector_chunks(note);
    const provider = new FakeEmbeddingProvider();
    const result = await provider.generate_embeddings({
      texts: chunks.map((chunk) => chunk.text),
    });

    const vector_index = build_vector_index({
      note,
      chunks,
      embeddings: result.embeddings,
      metadata: result,
      created_at: '2026-05-14T00:00:00.000Z',
    });

    expect(vector_index).toMatchObject({
      index_id: 'vec_note_20260514_test-note',
      note_id: 'note_20260514_test-note',
      embedding_model: 'fake-embedding',
      embedding_dimensions: 2,
    });
    expect(vector_index.chunks).toHaveLength(chunks.length);
  });

  it('surfaces provider failures', async () => {
    const provider = new FakeEmbeddingProvider(new Error('provider failed'));

    await expect(
      provider.generate_embeddings({ texts: ['test'] }),
    ).rejects.toThrow('provider failed');
  });
});
