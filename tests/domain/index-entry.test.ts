import { describe, expect, it } from 'vitest';
import {
  assert_note_can_be_vector_indexed,
  parse_hybrid_retrieval_options,
  parse_hybrid_retrieval_result,
  parse_answer_fallback_result,
  parse_index_entry,
  parse_unconfirmed_evidence,
  parse_vector_index,
  validate_index_entry,
  validate_vector_index_for_note,
} from '../../src/domain/index-entry.js';
import { create_test_note } from '../note-test-helpers.js';
import { validate_note_invariants } from '../../src/domain/note.js';

describe('IndexEntry domain', () => {
  it('parses valid approved index entries', () => {
    expect(
      parse_index_entry({
        note_id: 'note_20260514_test-note',
        title: 'Test Note',
        summary: 'Summary',
        keywords: ['test'],
        tags: [],
        status: 'approved',
        approved_at: '2026-05-14T00:00:00.000Z',
        related_note_ids: [],
        vector_ref: null,
      }),
    ).toMatchObject({ status: 'approved', vector_ref: null });
  });

  it('parses approved index entries with vector_ref metadata', () => {
    expect(
      parse_index_entry({
        note_id: 'note_20260514_test-note',
        title: 'Test Note',
        summary: 'Summary',
        keywords: ['test'],
        tags: [],
        status: 'approved',
        approved_at: '2026-05-14T00:00:00.000Z',
        related_note_ids: [],
        vector_ref: {
          index_id: 'vec_note_20260514_test-note',
          path: '2026/05/note_20260514_test-note.vector.json',
          embedding_model: 'test-embedding',
          embedding_dimensions: 3,
          chunker_version: 'note-json-v1',
          created_at: '2026-05-14T00:00:00.000Z',
        },
      }),
    ).toMatchObject({
      vector_ref: { embedding_model: 'test-embedding' },
    });
  });

  it('rejects non-approved index status', () => {
    expect(() =>
      parse_index_entry({
        note_id: 'note_20260514_test-note',
        title: 'Test Note',
        summary: 'Summary',
        keywords: [],
        tags: [],
        status: 'draft',
        approved_at: '2026-05-14T00:00:00.000Z',
        related_note_ids: [],
        vector_ref: null,
      }),
    ).toThrow();
  });

  it('requires non-empty approved_at and summary', () => {
    expect(() =>
      validate_index_entry({
        note_id: 'note_20260514_test-note',
        title: 'Test Note',
        summary: '',
        keywords: [],
        tags: [],
        status: 'approved',
        approved_at: '',
        related_note_ids: [],
        vector_ref: null,
      }),
    ).toThrow('index entry must have approved_at');
  });

  it('parses valid vector indexes', () => {
    expect(
      parse_vector_index({
        index_id: 'vec_note_20260514_test-note',
        note_id: 'note_20260514_test-note',
        embedding_model: 'test-embedding',
        embedding_dimensions: 3,
        chunker_version: 'note-json-v1',
        created_at: '2026-05-14T00:00:00.000Z',
        chunks: [
          {
            chunk_id: 'chunk_0001',
            source_field: 'title',
            content_hash: 'abc123',
            text: 'Test Note',
            embedding: [0.1, 0.2, 0.3],
          },
        ],
      }),
    ).toMatchObject({ embedding_dimensions: 3 });
  });

  it('rejects vector indexes with mismatched dimensions', () => {
    expect(() =>
      parse_vector_index({
        index_id: 'vec_note_20260514_test-note',
        note_id: 'note_20260514_test-note',
        embedding_model: 'test-embedding',
        embedding_dimensions: 3,
        chunker_version: 'note-json-v1',
        created_at: '2026-05-14T00:00:00.000Z',
        chunks: [
          {
            chunk_id: 'chunk_0001',
            source_field: 'title',
            content_hash: 'abc123',
            text: 'Test Note',
            embedding: [0.1, 0.2],
          },
        ],
      }),
    ).toThrow('vector index chunk embedding dimension mismatch');
  });

  it('rejects empty vector chunk sets', () => {
    expect(() =>
      parse_vector_index({
        index_id: 'vec_note_20260514_test-note',
        note_id: 'note_20260514_test-note',
        embedding_model: 'test-embedding',
        embedding_dimensions: 3,
        chunker_version: 'note-json-v1',
        created_at: '2026-05-14T00:00:00.000Z',
        chunks: [],
      }),
    ).toThrow('vector index must have chunks');
  });

  it('allows only approved notes for vector indexing', () => {
    const approved_note = {
      ...create_test_note(),
      status: 'approved' as const,
      approved_at: '2026-05-14T00:00:00.000Z',
      quality_checks: {
        status: 'passed' as const,
        template_complete: true,
        source_links_present: true,
        empty_sections: [],
        last_checked_at: '2026-05-14T00:00:00.000Z',
      },
    };

    expect(() =>
      assert_note_can_be_vector_indexed(approved_note),
    ).not.toThrow();
    expect(() =>
      assert_note_can_be_vector_indexed({ ...approved_note, status: 'draft' }),
    ).toThrow('Note must be approved before vector indexing');
    expect(() =>
      assert_note_can_be_vector_indexed({
        ...approved_note,
        status: 'archived',
      }),
    ).toThrow('Note must be approved before vector indexing');
    expect(() =>
      assert_note_can_be_vector_indexed({
        ...approved_note,
        status: 'superseded',
        superseded_by_note_id: 'note_20260515_next-note',
      }),
    ).toThrow('Note must be approved before vector indexing');
  });

  it('validates vector index belongs to the approved note', () => {
    const note = {
      ...create_test_note(),
      status: 'approved' as const,
      approved_at: '2026-05-14T00:00:00.000Z',
      quality_checks: {
        status: 'passed' as const,
        template_complete: true,
        source_links_present: true,
        empty_sections: [],
        last_checked_at: '2026-05-14T00:00:00.000Z',
      },
    };

    expect(() =>
      validate_vector_index_for_note(
        {
          index_id: 'vec_note_20260514_other-note',
          note_id: 'note_20260514_other-note',
          embedding_model: 'test-embedding',
          embedding_dimensions: 1,
          chunker_version: 'note-json-v1',
          created_at: '2026-05-14T00:00:00.000Z',
          chunks: [
            {
              chunk_id: 'chunk_0001',
              source_field: 'title',
              content_hash: 'abc123',
              text: 'Other',
              embedding: [0.1],
            },
          ],
        },
        note,
      ),
    ).toThrow('vector index note_id must match note id');
  });

  it('parses hybrid retrieval options with metadata filters', () => {
    expect(
      parse_hybrid_retrieval_options({
        top_k: 5,
        metadata_filter: {
          tags: ['agent'],
          keywords: ['memory'],
          related_note_ids: ['note_20260514_related'],
          approved_at_from: '2026-05-01T00:00:00.000Z',
          approved_at_to: '2026-05-31T23:59:59.000Z',
          boost_keywords: ['workflow'],
          boost_tags: ['p0'],
        },
        weights: { keyword: 0.4, metadata: 0.2, vector: 0.4 },
        include_debug: true,
      }),
    ).toMatchObject({ top_k: 5, metadata_filter: { tags: ['agent'] } });
  });

  it('parses hybrid retrieval results with signal explanations', () => {
    expect(
      parse_hybrid_retrieval_result({
        note_id: 'note_20260514_test-note',
        final_score: 0.9,
        signals: [
          {
            type: 'keyword',
            score: 2,
            normalized_score: 1,
            explanation: 'matched title: test',
          },
          {
            type: 'metadata',
            score: 1,
            normalized_score: 0.5,
            explanation: 'matched tag: agent',
          },
        ],
        debug: ['vector unavailable: no vector_ref'],
      }),
    ).toMatchObject({
      note_id: 'note_20260514_test-note',
      final_score: 0.9,
      retrieval_role: 'direct',
    });
  });

  it('parses related hybrid retrieval results with expansion metadata', () => {
    expect(
      parse_hybrid_retrieval_result({
        note_id: 'note_20260514_related-note',
        final_score: 0,
        retrieval_role: 'related',
        related_via_note_id: 'note_20260514_direct-note',
        related_via_title: 'Direct Note',
        signals: [
          {
            type: 'metadata',
            score: 1,
            normalized_score: 0,
            explanation: 'related via note_20260514_direct-note',
          },
        ],
        debug: [],
      }),
    ).toMatchObject({
      note_id: 'note_20260514_related-note',
      retrieval_role: 'related',
      related_via_note_id: 'note_20260514_direct-note',
    });
  });

  it('rejects invalid hybrid retrieval results', () => {
    expect(() =>
      parse_hybrid_retrieval_result({
        note_id: '',
        final_score: 0.9,
        signals: [
          {
            type: 'keyword',
            score: 1,
            normalized_score: 1,
            explanation: 'matched',
          },
        ],
        debug: [],
      }),
    ).toThrow('hybrid retrieval result must have note_id');
    expect(() =>
      parse_hybrid_retrieval_result({
        note_id: 'note_20260514_test-note',
        final_score: -1,
        signals: [
          {
            type: 'keyword',
            score: 1,
            normalized_score: 1,
            explanation: 'matched',
          },
        ],
        debug: [],
      }),
    ).toThrow();
    expect(() =>
      parse_hybrid_retrieval_result({
        note_id: 'note_20260514_test-note',
        final_score: 0,
        signals: [],
        debug: [],
      }),
    ).toThrow('hybrid retrieval result must have signals');
    expect(() =>
      parse_hybrid_retrieval_result({
        note_id: 'note_20260514_related-note',
        final_score: 0,
        retrieval_role: 'related',
        signals: [
          {
            type: 'metadata',
            score: 1,
            normalized_score: 0,
            explanation: 'related',
          },
        ],
        debug: [],
      }),
    ).toThrow('related retrieval result must have related_via_note_id');
    expect(() =>
      parse_hybrid_retrieval_result({
        note_id: 'note_20260514_direct-note',
        final_score: 1,
        retrieval_role: 'direct',
        related_via_note_id: 'note_20260514_other-note',
        signals: [
          {
            type: 'keyword',
            score: 1,
            normalized_score: 1,
            explanation: 'matched',
          },
        ],
        debug: [],
      }),
    ).toThrow('direct retrieval result must not have related_via_note_id');
  });

  it('parses fully labeled unconfirmed evidence', () => {
    expect(
      parse_unconfirmed_evidence({
        confirmation_status: 'unconfirmed',
        material_type: 'processed_segment',
        source_id: 'src_20260514_upload_markdown_test-source',
        source_title: 'Test Source',
        source_status: 'processed',
        evidence_ref: 'processed/segments.json#seg_0001',
        excerpt: 'Unconfirmed excerpt.',
        limitations: ['This material has not become approved knowledge.'],
      }),
    ).toMatchObject({ confirmation_status: 'unconfirmed' });
  });

  it('rejects invalid unconfirmed evidence labels and empty fields', () => {
    const base = {
      confirmation_status: 'unconfirmed',
      material_type: 'processed_segment',
      source_id: 'src_20260514_upload_markdown_test-source',
      source_title: 'Test Source',
      source_status: 'processed',
      evidence_ref: 'processed/segments.json#seg_0001',
      excerpt: 'Unconfirmed excerpt.',
      limitations: ['This material has not become approved knowledge.'],
    };

    expect(() =>
      parse_unconfirmed_evidence({ ...base, confirmation_status: 'approved' }),
    ).toThrow();
    expect(() =>
      parse_unconfirmed_evidence({ ...base, material_type: 'raw_artifact' }),
    ).toThrow();
    expect(() =>
      parse_unconfirmed_evidence({ ...base, evidence_ref: '' }),
    ).toThrow('unconfirmed evidence must have evidence_ref');
    expect(() => parse_unconfirmed_evidence({ ...base, excerpt: '' })).toThrow(
      'unconfirmed evidence must have excerpt',
    );
    expect(() =>
      parse_unconfirmed_evidence({ ...base, limitations: [] }),
    ).toThrow('unconfirmed evidence must have limitations');
  });

  it('parses fallback result and validates all evidence items', () => {
    expect(
      parse_answer_fallback_result({
        enabled: true,
        evidence: [
          {
            confirmation_status: 'unconfirmed',
            material_type: 'draft_understanding',
            source_id: 'src_20260514_upload_markdown_test-source',
            source_title: 'Test Source',
            source_status: 'understood',
            evidence_ref: 'source.json#draft_understanding',
            excerpt: 'Draft understanding excerpt.',
            limitations: ['Draft understanding has not been approved.'],
          },
        ],
      }),
    ).toMatchObject({ enabled: true });
  });

  it('requires approved notes to have approved_at and passed quality checks', () => {
    expect(() =>
      validate_note_invariants({ ...create_test_note(), status: 'approved' }),
    ).toThrow('approved note must have approved_at');
    expect(() =>
      validate_note_invariants({
        ...create_test_note(),
        status: 'approved',
        approved_at: '2026-05-14T00:00:00.000Z',
      }),
    ).toThrow('approved note must pass quality_checks');
  });
});
