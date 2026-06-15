import { describe, expect, it } from 'vitest';
import {
  __test_only__,
  ConfiguredEmbeddingProvider,
  type VoyageEmbeddingsAdapter,
} from '../../src/agents/embedding-provider.js';
import { AgentError } from '../../src/agents/errors.js';

const resolved_config = {
  provider: 'voyage',
  type: 'voyage',
  base_url: 'https://api.voyageai.com/v1',
  api_key: 'voyage-key',
  model: 'voyage-4',
  embedding_dimensions: 2,
} as const;

describe('configured embedding provider', () => {
  it('generates embeddings through a mockable adapter', async () => {
    const adapter: VoyageEmbeddingsAdapter = {
      create_embeddings: async (input) => {
        expect(input).toEqual({
          input: ['alpha', 'beta'],
          model: 'voyage-4',
          input_type: 'document',
          output_dimension: 2,
        });
        return {
          model: 'voyage-4',
          data: [
            { embedding: [1, 0], index: 0 },
            { embedding: [0, 1], index: 1 },
          ],
        };
      },
    };
    const provider = new ConfiguredEmbeddingProvider({
      config: resolved_config,
      adapter,
    });

    await expect(
      provider.generate_embeddings({ texts: ['alpha', 'beta'] }),
    ).resolves.toEqual({
      embedding_model: 'voyage-4',
      embedding_dimensions: 2,
      embeddings: [
        [1, 0],
        [0, 1],
      ],
    });
  });

  it('passes query input_type to the adapter', async () => {
    let input_type: string | undefined;
    const adapter: VoyageEmbeddingsAdapter = {
      create_embeddings: async (input) => {
        input_type = input.input_type;
        return {
          model: 'voyage-4',
          data: [{ embedding: [1, 0] }],
        };
      },
    };
    const provider = new ConfiguredEmbeddingProvider({
      config: resolved_config,
      adapter,
    });

    await provider.generate_embeddings({
      texts: ['query'],
      input_type: 'query',
    });

    expect(input_type).toBe('query');
  });

  it('rejects empty input', async () => {
    const provider = new ConfiguredEmbeddingProvider({
      config: resolved_config,
      adapter: {
        create_embeddings: async () => ({ data: [] }),
      },
    });

    await expect(provider.generate_embeddings({ texts: [] })).rejects.toThrow(
      'Embedding input texts must not be empty.',
    );
  });

  it('maps adapter failure to AgentError', async () => {
    const provider = new ConfiguredEmbeddingProvider({
      config: resolved_config,
      adapter: {
        create_embeddings: async () => {
          throw new Error('provider unavailable');
        },
      },
    });

    await expect(
      provider.generate_embeddings({ texts: ['alpha'] }),
    ).rejects.toMatchObject({
      name: 'AgentError',
      code: 'LLM_CALL_FAILED',
      message: 'provider unavailable',
    });
  });

  it('rejects embedding count mismatches', async () => {
    const provider = new ConfiguredEmbeddingProvider({
      config: resolved_config,
      adapter: {
        create_embeddings: async () => ({
          model: 'voyage-4',
          data: [{ embedding: [1, 0] }],
        }),
      },
    });

    await expect(
      provider.generate_embeddings({ texts: ['alpha', 'beta'] }),
    ).rejects.toThrow('Embedding provider returned 1 embeddings for 2 inputs.');
  });

  it('rejects non-array embeddings', () => {
    expect(() =>
      __test_only__.parse_embeddings_response({
        response: { data: [{ embedding: 'bad' }] },
        expected_count: 1,
        expected_dimensions: 2,
      }),
    ).toThrow(AgentError);
  });

  it('rejects non-finite vector values', async () => {
    const provider = new ConfiguredEmbeddingProvider({
      config: resolved_config,
      adapter: {
        create_embeddings: async () => ({
          model: 'voyage-4',
          data: [{ embedding: [1, Number.NaN] }],
        }),
      },
    });

    await expect(
      provider.generate_embeddings({ texts: ['alpha'] }),
    ).rejects.toThrow('Embedding value at index 0.1 must be a finite number.');
  });

  it('rejects dimension mismatches', async () => {
    const provider = new ConfiguredEmbeddingProvider({
      config: resolved_config,
      adapter: {
        create_embeddings: async () => ({
          model: 'voyage-4',
          data: [{ embedding: [1, 0, 0] }],
        }),
      },
    });

    await expect(
      provider.generate_embeddings({ texts: ['alpha'] }),
    ).rejects.toThrow('Embedding at index 0 has 3 dimensions, expected 2.');
  });
});
