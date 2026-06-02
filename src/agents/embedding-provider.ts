import type { EmbeddingMetadata } from '../domain/index-entry.js';
import { AgentError } from './errors.js';

export type GenerateEmbeddingsInput = {
  texts: string[];
};

export type GenerateEmbeddingsResult = EmbeddingMetadata & {
  embeddings: number[][];
};

export interface EmbeddingProvider {
  generate_embeddings(
    input: GenerateEmbeddingsInput,
  ): Promise<GenerateEmbeddingsResult>;
}

export class UnsupportedEmbeddingProvider implements EmbeddingProvider {
  async generate_embeddings(): Promise<GenerateEmbeddingsResult> {
    throw new AgentError({
      code: 'LLM_CALL_FAILED',
      message: 'Embedding provider is not configured.',
    });
  }
}
