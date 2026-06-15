import { z } from 'zod';
import type { Note } from './note.js';

export const VectorIndexRefSchema = z.object({
  index_id: z.string(),
  path: z.string(),
  embedding_model: z.string(),
  embedding_dimensions: z.number().int().positive(),
  chunker_version: z.string(),
  created_at: z.string(),
});

export const EmbeddingMetadataSchema = z.object({
  embedding_model: z.string(),
  embedding_dimensions: z.number().int().positive(),
});

export const VectorIndexChunkSchema = z.object({
  chunk_id: z.string(),
  source_field: z.string(),
  content_hash: z.string(),
  text: z.string(),
  embedding: z.array(z.number()),
});

export const VectorIndexSchema = z.object({
  index_id: z.string(),
  note_id: z.string(),
  embedding_model: z.string(),
  embedding_dimensions: z.number().int().positive(),
  chunker_version: z.string(),
  created_at: z.string(),
  chunks: z.array(VectorIndexChunkSchema),
});

export const UnconfirmedEvidenceSchema = z.object({
  confirmation_status: z.literal('unconfirmed'),
  material_type: z.enum([
    'processed_segment',
    'processed_text',
    'draft_understanding',
    'discussion_summary',
  ]),
  source_id: z.string(),
  source_title: z.string(),
  source_status: z.string(),
  evidence_ref: z.string(),
  excerpt: z.string(),
  limitations: z.array(z.string()),
});

export const AnswerFallbackOptionsSchema = z.object({
  enabled: z.boolean(),
  max_items: z.number().int().positive().optional(),
  max_excerpt_length: z.number().int().positive().optional(),
});

export const AnswerFallbackResultSchema = z.object({
  enabled: z.boolean(),
  evidence: z.array(UnconfirmedEvidenceSchema),
});

export const HybridRetrievalSignalSchema = z.object({
  type: z.enum(['keyword', 'metadata', 'vector']),
  score: z.number().min(0),
  normalized_score: z.number().min(0).max(1),
  explanation: z.string(),
});

export const MetadataFilterSchema = z.object({
  tags: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  related_note_ids: z.array(z.string()).optional(),
  approved_at_from: z.string().optional(),
  approved_at_to: z.string().optional(),
  boost_keywords: z.array(z.string()).optional(),
  boost_tags: z.array(z.string()).optional(),
});

export const HybridRetrievalOptionsSchema = z.object({
  top_k: z.number().int().positive(),
  metadata_filter: MetadataFilterSchema.optional(),
  weights: z
    .object({
      keyword: z.number().min(0),
      metadata: z.number().min(0),
      vector: z.number().min(0),
    })
    .optional(),
  include_debug: z.boolean().optional(),
});

export const AnswerRetrievalRoleSchema = z.enum(['direct', 'related']);

export const HybridRetrievalResultSchema = z.object({
  note_id: z.string(),
  final_score: z.number().min(0),
  signals: z.array(HybridRetrievalSignalSchema),
  debug: z.array(z.string()),
  retrieval_role: AnswerRetrievalRoleSchema.default('direct'),
  related_via_note_id: z.string().optional(),
  related_via_title: z.string().optional(),
});

export const IndexEntrySchema = z.object({
  note_id: z.string(),
  title: z.string(),
  summary: z.string(),
  keywords: z.array(z.string()),
  tags: z.array(z.string()),
  status: z.literal('approved'),
  approved_at: z.string(),
  related_note_ids: z.array(z.string()),
  vector_ref: VectorIndexRefSchema.nullable(),
});

export type VectorIndexRef = z.infer<typeof VectorIndexRefSchema>;
export type EmbeddingMetadata = z.infer<typeof EmbeddingMetadataSchema>;
export type VectorIndexChunk = z.infer<typeof VectorIndexChunkSchema>;
export type VectorIndex = z.infer<typeof VectorIndexSchema>;
export type UnconfirmedEvidence = z.infer<typeof UnconfirmedEvidenceSchema>;
export type AnswerFallbackOptions = z.infer<typeof AnswerFallbackOptionsSchema>;
export type AnswerFallbackResult = z.infer<typeof AnswerFallbackResultSchema>;
export type HybridRetrievalSignal = z.infer<typeof HybridRetrievalSignalSchema>;
export type AnswerRetrievalRole = z.infer<typeof AnswerRetrievalRoleSchema>;
export type MetadataFilter = z.infer<typeof MetadataFilterSchema>;
export type HybridRetrievalOptions = z.infer<
  typeof HybridRetrievalOptionsSchema
>;
export type HybridRetrievalResult = z.infer<typeof HybridRetrievalResultSchema>;
export type IndexEntry = z.infer<typeof IndexEntrySchema>;

export function validate_unconfirmed_evidence(
  evidence: UnconfirmedEvidence,
): void {
  if (evidence.confirmation_status !== 'unconfirmed') {
    throw new Error('unconfirmed evidence must be labeled unconfirmed');
  }
  if (evidence.source_id.trim().length === 0) {
    throw new Error('unconfirmed evidence must have source_id');
  }
  if (evidence.source_title.trim().length === 0) {
    throw new Error('unconfirmed evidence must have source_title');
  }
  if (evidence.source_status.trim().length === 0) {
    throw new Error('unconfirmed evidence must have source_status');
  }
  if (evidence.evidence_ref.trim().length === 0) {
    throw new Error('unconfirmed evidence must have evidence_ref');
  }
  if (evidence.excerpt.trim().length === 0) {
    throw new Error('unconfirmed evidence must have excerpt');
  }
  if (evidence.limitations.length === 0) {
    throw new Error('unconfirmed evidence must have limitations');
  }
}

export function parse_unconfirmed_evidence(
  value: unknown,
): UnconfirmedEvidence {
  const evidence = UnconfirmedEvidenceSchema.parse(value);
  validate_unconfirmed_evidence(evidence);
  return evidence;
}

export function parse_answer_fallback_result(
  value: unknown,
): AnswerFallbackResult {
  const result = AnswerFallbackResultSchema.parse(value);
  for (const evidence of result.evidence) {
    validate_unconfirmed_evidence(evidence);
  }
  return result;
}

export function validate_hybrid_retrieval_result(
  result: HybridRetrievalResult,
): void {
  if (result.note_id.trim().length === 0) {
    throw new Error('hybrid retrieval result must have note_id');
  }
  if (!Number.isFinite(result.final_score) || result.final_score < 0) {
    throw new Error('hybrid retrieval result final_score must be non-negative');
  }
  if (result.signals.length === 0) {
    throw new Error('hybrid retrieval result must have signals');
  }
  if (result.retrieval_role === 'direct') {
    if (result.related_via_note_id !== undefined) {
      throw new Error(
        'direct retrieval result must not have related_via_note_id',
      );
    }
  } else if (
    result.related_via_note_id === undefined ||
    result.related_via_note_id.trim().length === 0
  ) {
    throw new Error('related retrieval result must have related_via_note_id');
  }
  for (const signal of result.signals) {
    if (!Number.isFinite(signal.score) || signal.score < 0) {
      throw new Error('hybrid retrieval signal score must be non-negative');
    }
    if (signal.explanation.trim().length === 0) {
      throw new Error('hybrid retrieval signal must have explanation');
    }
  }
}

export function parse_hybrid_retrieval_options(
  value: unknown,
): HybridRetrievalOptions {
  return HybridRetrievalOptionsSchema.parse(value);
}

export function parse_hybrid_retrieval_result(
  value: unknown,
): HybridRetrievalResult {
  const result = HybridRetrievalResultSchema.parse(value);
  validate_hybrid_retrieval_result(result);
  return result;
}

export function validate_vector_index(vector_index: VectorIndex): void {
  if (vector_index.index_id.trim().length === 0) {
    throw new Error('vector index must have index_id');
  }
  if (vector_index.note_id.trim().length === 0) {
    throw new Error('vector index must have note_id');
  }
  if (vector_index.embedding_model.trim().length === 0) {
    throw new Error('vector index must have embedding_model');
  }
  if (vector_index.chunker_version.trim().length === 0) {
    throw new Error('vector index must have chunker_version');
  }
  if (vector_index.created_at.trim().length === 0) {
    throw new Error('vector index must have created_at');
  }
  if (vector_index.chunks.length === 0) {
    throw new Error('vector index must have chunks');
  }

  for (const chunk of vector_index.chunks) {
    if (chunk.chunk_id.trim().length === 0) {
      throw new Error('vector index chunk must have chunk_id');
    }
    if (chunk.source_field.trim().length === 0) {
      throw new Error('vector index chunk must have source_field');
    }
    if (chunk.content_hash.trim().length === 0) {
      throw new Error('vector index chunk must have content_hash');
    }
    if (chunk.text.trim().length === 0) {
      throw new Error('vector index chunk must have text');
    }
    if (chunk.embedding.length !== vector_index.embedding_dimensions) {
      throw new Error('vector index chunk embedding dimension mismatch');
    }
  }
}

export function assert_note_can_be_vector_indexed(note: Note): void {
  if (note.status !== 'approved') {
    throw new Error(
      `Note must be approved before vector indexing. Current status: ${note.status}`,
    );
  }
}

export function validate_vector_index_for_note(
  vector_index: VectorIndex,
  note: Note,
): void {
  assert_note_can_be_vector_indexed(note);
  validate_vector_index(vector_index);
  if (vector_index.note_id !== note.id) {
    throw new Error('vector index note_id must match note id');
  }
}

export function parse_vector_index(value: unknown): VectorIndex {
  const vector_index = VectorIndexSchema.parse(value);
  validate_vector_index(vector_index);
  return vector_index;
}

export function validate_index_entry(entry: IndexEntry): void {
  if (entry.note_id.trim().length === 0) {
    throw new Error('index entry must have note_id');
  }
  if (entry.approved_at.trim().length === 0) {
    throw new Error('index entry must have approved_at');
  }
  if (entry.summary.trim().length === 0) {
    throw new Error('index entry must have summary');
  }
  if (entry.vector_ref !== null) {
    if (entry.vector_ref.index_id.trim().length === 0) {
      throw new Error('index entry vector_ref must have index_id');
    }
    if (entry.vector_ref.path.trim().length === 0) {
      throw new Error('index entry vector_ref must have path');
    }
    if (entry.vector_ref.embedding_model.trim().length === 0) {
      throw new Error('index entry vector_ref must have embedding_model');
    }
    if (entry.vector_ref.chunker_version.trim().length === 0) {
      throw new Error('index entry vector_ref must have chunker_version');
    }
    if (entry.vector_ref.created_at.trim().length === 0) {
      throw new Error('index entry vector_ref must have created_at');
    }
  }
}

export function parse_index_entry(value: unknown): IndexEntry {
  const entry = IndexEntrySchema.parse(value);
  validate_index_entry(entry);
  return entry;
}
