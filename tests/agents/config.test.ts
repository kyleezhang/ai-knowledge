import { describe, expect, it } from 'vitest';
import {
  default_agent_config,
  resolve_agent_embedding_config,
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
  embedding: {
    default: 'voyage',
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
      compact: {
        type: 'voyage',
        base_url: 'https://api.voyageai.com/v1',
        api_key_env: 'COMPACT_EMBEDDING_API_KEY',
        models: {
          embedding: 'voyage-4-lite',
        },
        embedding_dimensions: 256,
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

  it('resolves the default embedding provider', () => {
    const config = resolve_agent_embedding_config(
      { embedding: multi_provider_config.embedding },
      { VOYAGE_API_KEY: 'voyage-key' },
    );

    expect(config).toEqual({
      provider: 'voyage',
      type: 'voyage',
      base_url: 'https://api.voyageai.com/v1',
      api_key: 'voyage-key',
      model: 'voyage-4',
      embedding_dimensions: 1024,
    });
  });

  it('resolves an embedding provider override', () => {
    const config = resolve_agent_embedding_config(
      { embedding: multi_provider_config.embedding, provider: 'compact' },
      { COMPACT_EMBEDDING_API_KEY: 'compact-key' },
    );

    expect(config).toEqual({
      provider: 'compact',
      type: 'voyage',
      base_url: 'https://api.voyageai.com/v1',
      api_key: 'compact-key',
      model: 'voyage-4-lite',
      embedding_dimensions: 256,
    });
  });

  it('uses the built-in default voyage embedding provider when config is omitted', () => {
    const config = resolve_agent_embedding_config(
      {},
      { VOYAGE_API_KEY: 'voyage-key' },
    );

    expect(config).toEqual({
      provider: default_agent_config.embedding.default,
      type: 'voyage',
      base_url: 'https://api.voyageai.com/v1',
      api_key: 'voyage-key',
      model: 'voyage-4',
      embedding_dimensions: 1024,
    });
  });

  it('fails for an unknown embedding provider', () => {
    expect(() =>
      resolve_agent_embedding_config(
        { embedding: multi_provider_config.embedding, provider: 'missing' },
        { VOYAGE_API_KEY: 'voyage-key' },
      ),
    ).toThrow('Unknown embedding provider: missing');
  });

  it('fails for an unknown embedding model alias', () => {
    expect(() =>
      resolve_agent_embedding_config(
        { embedding: multi_provider_config.embedding, model_alias: 'chat' },
        { VOYAGE_API_KEY: 'voyage-key' },
      ),
    ).toThrow('Unknown embedding model alias for provider voyage: chat');
  });

  it('fails when the embedding provider api_key_env is missing', () => {
    expect(() =>
      resolve_agent_embedding_config(
        { embedding: multi_provider_config.embedding },
        {},
      ),
    ).toThrow(AgentError);
    expect(() =>
      resolve_agent_embedding_config(
        { embedding: multi_provider_config.embedding },
        {},
      ),
    ).toThrow('Missing API key environment variable: VOYAGE_API_KEY');
  });

  it('fails for invalid embedding dimensions', () => {
    expect(() =>
      resolve_agent_embedding_config(
        {
          embedding: {
            default: 'bad',
            providers: {
              bad: {
                type: 'voyage',
                base_url: 'https://api.voyageai.com/v1',
                api_key_env: 'BAD_EMBEDDING_API_KEY',
                models: { embedding: 'voyage-4' },
                embedding_dimensions: 0,
              },
            },
          },
        },
        { BAD_EMBEDDING_API_KEY: 'bad-key' },
      ),
    ).toThrow('Invalid embedding dimensions for provider bad: 0');
  });
});
