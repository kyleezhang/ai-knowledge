import { describe, expect, it } from 'vitest';
import {
  default_agent_config,
  resolve_agent_model_config,
  type AgentConfig,
} from '../../src/agents/config.js';
import { AgentError } from '../../src/agents/errors.js';

const multi_provider_config: AgentConfig = {
  knowledge_dir: './knowledge',
  model: {
    default: 'deepseek',
    providers: {
      deepseek: {
        type: 'anthropic_compatible',
        base_url: 'https://api.deepseek.com/anthropic',
        api_key_env: 'DEEPSEEK_API_KEY',
        models: {
          chat: 'deepseek-v4-pro',
        },
      },
      claude: {
        type: 'anthropic',
        base_url: 'https://api.anthropic.com',
        api_key_env: 'CLAUDE_API_KEY',
        models: {
          chat: 'claude-sonnet-4-5',
        },
      },
    },
  },
};

describe('agent config', () => {
  it('resolves the default provider', () => {
    const config = resolve_agent_model_config(
      { model: multi_provider_config.model },
      { DEEPSEEK_API_KEY: 'deepseek-key', CLAUDE_API_KEY: 'claude-key' },
    );

    expect(config).toEqual({
      provider: 'deepseek',
      type: 'anthropic_compatible',
      base_url: 'https://api.deepseek.com/anthropic',
      api_key: 'deepseek-key',
      model: 'deepseek-v4-pro',
    });
  });

  it('resolves a provider override', () => {
    const config = resolve_agent_model_config(
      { model: multi_provider_config.model, provider: 'claude' },
      { DEEPSEEK_API_KEY: 'deepseek-key', CLAUDE_API_KEY: 'claude-key' },
    );

    expect(config).toEqual({
      provider: 'claude',
      type: 'anthropic',
      base_url: 'https://api.anthropic.com',
      api_key: 'claude-key',
      model: 'claude-sonnet-4-5',
    });
  });

  it('uses the built-in default deepseek provider when config is omitted', () => {
    const config = resolve_agent_model_config(
      {},
      { DEEPSEEK_API_KEY: 'deepseek-key' },
    );

    expect(config).toEqual({
      provider: default_agent_config.model.default,
      type: 'anthropic_compatible',
      base_url: 'https://api.deepseek.com/anthropic',
      api_key: 'deepseek-key',
      model: 'deepseek-v4-pro',
    });
  });

  it('fails for an unknown provider', () => {
    expect(() =>
      resolve_agent_model_config(
        { model: multi_provider_config.model, provider: 'missing' },
        { DEEPSEEK_API_KEY: 'deepseek-key' },
      ),
    ).toThrow('Unknown model provider: missing');
  });

  it('fails for an unknown model alias', () => {
    expect(() =>
      resolve_agent_model_config(
        { model: multi_provider_config.model, model_alias: 'embed' },
        { DEEPSEEK_API_KEY: 'deepseek-key' },
      ),
    ).toThrow('Unknown model alias for provider deepseek: embed');
  });

  it('fails when the provider api_key_env is missing', () => {
    expect(() =>
      resolve_agent_model_config({ model: multi_provider_config.model }, {}),
    ).toThrow(AgentError);
    expect(() =>
      resolve_agent_model_config({ model: multi_provider_config.model }, {}),
    ).toThrow('Missing API key environment variable: DEEPSEEK_API_KEY');
  });
});
