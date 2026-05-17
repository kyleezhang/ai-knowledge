import { AgentError } from './errors.js';

export const default_model_provider = 'deepseek';
export const default_model_alias = 'chat';

export type AgentModelProviderType = 'anthropic' | 'anthropic_compatible';

export type AgentModelProviderConfig = {
  type: AgentModelProviderType;
  base_url?: string;
  auth_token?: string;
  api_key_env: string;
  models: Record<string, string>;
};

export type AgentModelConfig = {
  default: string;
  providers: Record<string, AgentModelProviderConfig>;
};

export type AgentConfig = {
  knowledge_dir?: string;
  model: AgentModelConfig;
};

export type AgentModelConfigInput = Partial<AgentConfig> & {
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
