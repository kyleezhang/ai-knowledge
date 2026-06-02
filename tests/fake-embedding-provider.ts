import type {
  EmbeddingProvider,
  GenerateEmbeddingsInput,
  GenerateEmbeddingsResult,
} from '../src/agents/embedding-provider.js';

export class FakeEmbeddingProvider implements EmbeddingProvider {
  constructor(
    private readonly output: GenerateEmbeddingsResult | Error = {
      embedding_model: 'fake-embedding',
      embedding_dimensions: 2,
      embeddings: [],
    },
  ) {}

  async generate_embeddings(
    input: GenerateEmbeddingsInput,
  ): Promise<GenerateEmbeddingsResult> {
    if (this.output instanceof Error) {
      throw this.output;
    }
    if (this.output.embeddings.length > 0) {
      return this.output;
    }
    return {
      ...this.output,
      embeddings: input.texts.map((text, index) => [text.length, index]),
    };
  }
}
