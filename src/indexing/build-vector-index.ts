import { createHash } from 'node:crypto';
import type {
  EmbeddingMetadata,
  VectorIndex,
  VectorIndexChunk,
} from '../domain/index-entry.js';
import { validate_vector_index_for_note } from '../domain/index-entry.js';
import type { Note } from '../domain/note.js';

export const note_json_chunker_version = 'note-json-v1';

export type NoteVectorChunkInput = Omit<VectorIndexChunk, 'embedding'>;

export function build_note_vector_chunks(note: Note): NoteVectorChunkInput[] {
  const fields = [
    ['title', note.title],
    ['current_understanding', note.current_understanding],
    ...note.conclusions.map(
      (item, index) => [`conclusions.${index}`, item] as const,
    ),
    ...note.why_it_matters.map(
      (item, index) => [`why_it_matters.${index}`, item] as const,
    ),
    ...note.open_questions.map(
      (item, index) => [`open_questions.${index}`, item] as const,
    ),
  ] as const;

  return fields
    .map(([source_field, text]) => ({ source_field, text: text.trim() }))
    .filter((item) => item.text.length > 0)
    .map((item, index) => ({
      chunk_id: `chunk_${String(index + 1).padStart(4, '0')}`,
      source_field: item.source_field,
      content_hash: hash_content(item.text),
      text: item.text,
    }));
}

export function build_vector_index(input: {
  note: Note;
  chunks: NoteVectorChunkInput[];
  embeddings: number[][];
  metadata: EmbeddingMetadata;
  created_at: string;
}): VectorIndex {
  if (input.chunks.length === 0) {
    throw new Error('vector index must have chunks');
  }
  if (input.embeddings.length !== input.chunks.length) {
    throw new Error('embedding count must match chunk count');
  }

  const vector_index: VectorIndex = {
    index_id: `vec_${input.note.id}`,
    note_id: input.note.id,
    embedding_model: input.metadata.embedding_model,
    embedding_dimensions: input.metadata.embedding_dimensions,
    chunker_version: note_json_chunker_version,
    created_at: input.created_at,
    chunks: input.chunks.map((chunk, index) => ({
      ...chunk,
      embedding: input.embeddings[index],
    })),
  };

  validate_vector_index_for_note(vector_index, input.note);
  return vector_index;
}

function hash_content(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
