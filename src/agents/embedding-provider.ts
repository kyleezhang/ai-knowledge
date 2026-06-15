import type { EmbeddingMetadata } from '../domain/index-entry.js';
import {
  resolve_agent_embedding_config,
  type AgentEmbeddingConfigInput,
  type ResolvedAgentEmbeddingConfig,
} from './config.js';
import { AgentError } from './errors.js';

export type GenerateEmbeddingsInput = {
  texts: string[];
  input_type?: EmbeddingInputType;
};

export type GenerateEmbeddingsResult = EmbeddingMetadata & {
  embeddings: number[][];
};

export type EmbeddingInputType = 'document' | 'query';

export interface EmbeddingProvider {
  generate_embeddings(
    input: GenerateEmbeddingsInput,
  ): Promise<GenerateEmbeddingsResult>;
}

export type VoyageEmbeddingsRequest = {
  input: string[];
  model: string;
  input_type: EmbeddingInputType;
  output_dimension?: number;
};

export type VoyageEmbeddingsResponse = {
  data: Array<{
    embedding: unknown;
    index?: number;
  }>;
  model?: string;
};

export interface VoyageEmbeddingsAdapter {
  create_embeddings(
    input: VoyageEmbeddingsRequest,
  ): Promise<VoyageEmbeddingsResponse>;
}

export type ConfiguredEmbeddingProviderInput = AgentEmbeddingConfigInput & {
  config?: ResolvedAgentEmbeddingConfig;
  adapter?: VoyageEmbeddingsAdapter;
  env?: NodeJS.ProcessEnv;
};

export class UnsupportedEmbeddingProvider implements EmbeddingProvider {
  async generate_embeddings(): Promise<GenerateEmbeddingsResult> {
    throw new AgentError({
      code: 'LLM_CALL_FAILED',
      message: 'Embedding provider is not configured.',
    });
  }
}

export class ConfiguredEmbeddingProvider implements EmbeddingProvider {
  private readonly config: ResolvedAgentEmbeddingConfig;
  private readonly adapter: VoyageEmbeddingsAdapter;

  constructor(input: ConfiguredEmbeddingProviderInput = {}) {
    this.config =
      input.config ?? resolve_agent_embedding_config(input, input.env);
    this.adapter =
      input.adapter ?? new VoyageHttpEmbeddingsAdapter(this.config);
  }

  async generate_embeddings(
    input: GenerateEmbeddingsInput,
  ): Promise<GenerateEmbeddingsResult> {
    if (input.texts.length === 0) {
      throw new AgentError({
        code: 'LLM_CALL_FAILED',
        message: 'Embedding input texts must not be empty.',
      });
    }

    const response = await this.call_adapter(input);
    const embeddings = parse_embeddings_response({
      response,
      expected_count: input.texts.length,
      expected_dimensions: this.config.embedding_dimensions,
    });

    return {
      embedding_model: response.model ?? this.config.model,
      embedding_dimensions: this.config.embedding_dimensions,
      embeddings,
    };
  }

  private async call_adapter(
    input: GenerateEmbeddingsInput,
  ): Promise<VoyageEmbeddingsResponse> {
    try {
      return await this.adapter.create_embeddings({
        input: input.texts,
        model: this.config.model,
        input_type: input.input_type ?? 'document',
        output_dimension: this.config.embedding_dimensions,
      });
    } catch (error) {
      if (error instanceof AgentError) {
        throw error;
      }
      throw new AgentError({
        code: 'LLM_CALL_FAILED',
        message:
          error instanceof Error ? error.message : 'Embedding provider failed.',
        cause: error,
      });
    }
  }
}

export class VoyageHttpEmbeddingsAdapter implements VoyageEmbeddingsAdapter {
  constructor(private readonly config: ResolvedAgentEmbeddingConfig) {}

  async create_embeddings(
    input: VoyageEmbeddingsRequest,
  ): Promise<VoyageEmbeddingsResponse> {
    const response = await fetch(`${this.config.base_url}/embeddings`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.config.api_key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new AgentError({
        code: 'LLM_CALL_FAILED',
        message: `Embedding provider request failed with status ${response.status}.`,
      });
    }

    return (await response.json()) as VoyageEmbeddingsResponse;
  }
}

function parse_embeddings_response(input: {
  response: VoyageEmbeddingsResponse;
  expected_count: number;
  expected_dimensions: number;
}): number[][] {
  const data = input.response.data;
  if (!Array.isArray(data)) {
    throw new AgentError({
      code: 'LLM_OUTPUT_SCHEMA_FAILED',
      message: 'Embedding provider response data must be an array.',
    });
  }

  if (data.length !== input.expected_count) {
    throw new AgentError({
      code: 'LLM_OUTPUT_SCHEMA_FAILED',
      message: `Embedding provider returned ${data.length} embeddings for ${input.expected_count} inputs.`,
    });
  }

  return data.map((item, index) => {
    const embedding = item.embedding;
    if (!Array.isArray(embedding)) {
      throw new AgentError({
        code: 'LLM_OUTPUT_SCHEMA_FAILED',
        message: `Embedding at index ${index} must be an array.`,
      });
    }
    if (embedding.length !== input.expected_dimensions) {
      throw new AgentError({
        code: 'LLM_OUTPUT_SCHEMA_FAILED',
        message: `Embedding at index ${index} has ${embedding.length} dimensions, expected ${input.expected_dimensions}.`,
      });
    }
    return embedding.map((value, value_index) => {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new AgentError({
          code: 'LLM_OUTPUT_SCHEMA_FAILED',
          message: `Embedding value at index ${index}.${value_index} must be a finite number.`,
        });
      }
      return value;
    });
  });
}

export const __test_only__ = {
  parse_embeddings_response,
};
