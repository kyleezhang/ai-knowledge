import { AgentError } from './errors.js';

export const default_model_provider = 'deepseek';
export const default_model_alias = 'chat';
export const default_embedding_provider = 'voyage';
export const default_embedding_model_alias = 'embedding';

export type AgentModelProviderType = 'anthropic' | 'anthropic_compatible';
export type AgentEmbeddingProviderType = 'voyage';

export type AgentModelProviderConfig = {
  type: AgentModelProviderType;
  base_url?: string;
  auth_token?: string;
  api_key_env: string;
  models: Record<string, string>;
};

export type AgentEmbeddingProviderConfig = {
  type: AgentEmbeddingProviderType;
  base_url: string;
  api_key_env: string;
  models: Record<string, string>;
  embedding_dimensions: number;
};

export type AgentModelConfig = {
  default: string;
  providers: Record<string, AgentModelProviderConfig>;
};

export type AgentEmbeddingConfig = {
  default: string;
  providers: Record<string, AgentEmbeddingProviderConfig>;
};

export type AgentConfig = {
  knowledge_dir?: string;
  model: AgentModelConfig;
  embedding: AgentEmbeddingConfig;
};

export type AgentModelConfigInput = Partial<AgentConfig> & {
  provider?: string;
  model_alias?: string;
};

export type AgentEmbeddingConfigInput = Partial<AgentConfig> & {
  provider?: string;
  model_alias?: string;
};

export type ResolvedAgentModelConfig = {
  provider: string;
  type: AgentModelProviderType;
  base_url?: string;
  api_key: string;
  auth_token?: string;
  model: string;
};

export type ResolvedAgentEmbeddingConfig = {
  provider: string;
  type: AgentEmbeddingProviderType;
  base_url: string;
  api_key: string;
  model: string;
  embedding_dimensions: number;
};

export const default_agent_config: AgentConfig = {
  knowledge_dir: './knowledge',
  model: {
    default: default_model_provider,
    providers: {
      deepseek: {
        type: 'anthropic_compatible',
        base_url: 'https://api.deepseek.com/anthropic',
        api_key_env: 'DEEPSEEK_API_KEY',
        models: {
          chat: 'deepseek-v4-pro',
        },
      },
    },
  },
  embedding: {
    default: default_embedding_provider,
    providers: {
      voyage: {
        type: 'voyage',
        base_url: 'https://api.voyageai.com/v1',
        api_key_env: 'VOYAGE_API_KEY',
        models: {
          embedding: 'voyage-4',
        },
        embedding_dimensions: 1024,
      },
    },
  },
};

export function resolve_agent_model_config(
  input: AgentModelConfigInput = {},
  env: NodeJS.ProcessEnv = process.env,
): ResolvedAgentModelConfig {
  const model_config = merge_model_config(input.model);
  const provider_name = input.provider ?? model_config.default;
  const provider = model_config.providers[provider_name];
  if (provider === undefined) {
    throw new AgentError({
      code: 'LLM_CALL_FAILED',
      message: `Unknown model provider: ${provider_name}`,
    });
  }

  const model_alias = input.model_alias ?? default_model_alias;
  const model = provider.models[model_alias];
  if (model === undefined) {
    throw new AgentError({
      code: 'LLM_CALL_FAILED',
      message: `Unknown model alias for provider ${provider_name}: ${model_alias}`,
    });
  }

  const api_key = env[provider.api_key_env];
  if (api_key === undefined || api_key.trim().length === 0) {
    throw new AgentError({
      code: 'LLM_CALL_FAILED',
      message: `Missing API key environment variable: ${provider.api_key_env}`,
    });
  }

  return {
    provider: provider_name,
    type: provider.type,
    base_url: provider.base_url,
    auth_token: provider.auth_token,
    api_key,
    model,
  };
}

export function resolve_agent_embedding_config(
  input: AgentEmbeddingConfigInput = {},
  env: NodeJS.ProcessEnv = process.env,
): ResolvedAgentEmbeddingConfig {
  const embedding_config = merge_embedding_config(input.embedding);
  const provider_name = input.provider ?? embedding_config.default;
  const provider = embedding_config.providers[provider_name];
  if (provider === undefined) {
    throw new AgentError({
      code: 'LLM_CALL_FAILED',
      message: `Unknown embedding provider: ${provider_name}`,
    });
  }

  const model_alias = input.model_alias ?? default_embedding_model_alias;
  const model = provider.models[model_alias];
  if (model === undefined) {
    throw new AgentError({
      code: 'LLM_CALL_FAILED',
      message: `Unknown embedding model alias for provider ${provider_name}: ${model_alias}`,
    });
  }

  if (!Number.isInteger(provider.embedding_dimensions)) {
    throw new AgentError({
      code: 'LLM_CALL_FAILED',
      message: `Invalid embedding dimensions for provider ${provider_name}: ${provider.embedding_dimensions}`,
    });
  }

  if (provider.embedding_dimensions <= 0) {
    throw new AgentError({
      code: 'LLM_CALL_FAILED',
      message: `Invalid embedding dimensions for provider ${provider_name}: ${provider.embedding_dimensions}`,
    });
  }

  const api_key = env[provider.api_key_env];
  if (api_key === undefined || api_key.trim().length === 0) {
    throw new AgentError({
      code: 'LLM_CALL_FAILED',
      message: `Missing API key environment variable: ${provider.api_key_env}`,
    });
  }

  return {
    provider: provider_name,
    type: provider.type,
    base_url: provider.base_url,
    api_key,
    model,
    embedding_dimensions: provider.embedding_dimensions,
  };
}

function merge_model_config(
  input: Partial<AgentModelConfig> | undefined,
): AgentModelConfig {
  if (input === undefined) {
    return default_agent_config.model;
  }

  return {
    default: input.default ?? default_agent_config.model.default,
    providers: {
      ...default_agent_config.model.providers,
      ...input.providers,
    },
  };
}

function merge_embedding_config(
  input: Partial<AgentEmbeddingConfig> | undefined,
): AgentEmbeddingConfig {
  if (input === undefined) {
    return default_agent_config.embedding;
  }

  return {
    default: input.default ?? default_agent_config.embedding.default,
    providers: {
      ...default_agent_config.embedding.providers,
      ...input.providers,
    },
  };
}
