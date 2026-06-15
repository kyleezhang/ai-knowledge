import type { EmbeddingProvider } from '../agents/embedding-provider.js';
import { ConfiguredEmbeddingProvider } from '../agents/embedding-provider.js';
import { build_index_entry } from '../indexing/build-index-entry.js';
import {
  build_note_vector_chunks,
  build_vector_index,
} from '../indexing/build-vector-index.js';
import type { IndexEntry } from '../domain/index-entry.js';
import type { StorageConfig } from '../storage/config.js';
import { StorageError } from '../storage/errors.js';
import { save_index_entry, save_vector_index } from '../storage/index-repo.js';
import { get_note } from '../storage/note-repo.js';
import { vector_index_ref_path } from '../storage/paths.js';
import type { WorkflowResult } from './types.js';

export type IndexNoteWorkflowInput = {
  note_id: string;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
  include_vector?: boolean;
  embedding_provider?: EmbeddingProvider;
  now?: Date;
};

export type IndexNoteWorkflowData = {
  note_id: string;
  index_entry: IndexEntry;
  vector_index_ref: IndexEntry['vector_ref'];
};

export async function index_note_workflow(
  input: IndexNoteWorkflowInput,
): Promise<WorkflowResult<IndexNoteWorkflowData>> {
  const context = { config: input.storage_config, cwd: input.cwd };
  try {
    const note = await get_note(input.note_id, context);
    if (note.status !== 'approved') {
      return {
        ok: false,
        error: {
          code: 'INVALID_STATE',
          message: `Note must be approved before indexing. Current status: ${note.status}`,
        },
      };
    }

    let index_entry = build_index_entry(note);

    if (input.include_vector === true) {
      const chunks = build_note_vector_chunks(note);
      const provider =
        input.embedding_provider ?? new ConfiguredEmbeddingProvider();
      const embedding_result = await provider.generate_embeddings({
        texts: chunks.map((chunk) => chunk.text),
        input_type: 'document',
      });
      const vector_index = build_vector_index({
        note,
        chunks,
        embeddings: embedding_result.embeddings,
        metadata: embedding_result,
        created_at: (input.now ?? new Date()).toISOString(),
      });
      await save_vector_index(vector_index, context);
      index_entry = {
        ...index_entry,
        vector_ref: {
          index_id: vector_index.index_id,
          path: vector_index_ref_path(note.id),
          embedding_model: vector_index.embedding_model,
          embedding_dimensions: vector_index.embedding_dimensions,
          chunker_version: vector_index.chunker_version,
          created_at: vector_index.created_at,
        },
      };
    }

    await save_index_entry(index_entry, context);

    return {
      ok: true,
      data: {
        note_id: note.id,
        index_entry,
        vector_index_ref: index_entry.vector_ref,
      },
    };
  } catch (error) {
    if (error instanceof StorageError && error.code === 'NOT_FOUND') {
      return {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: `Note not found: ${input.note_id}`,
          cause: error,
        },
      };
    }
    return {
      ok: false,
      error: {
        code: error instanceof StorageError ? 'STORAGE_FAILED' : 'UNKNOWN',
        message:
          error instanceof Error ? error.message : 'Failed to index Note.',
        cause: error,
      },
    };
  }
}
