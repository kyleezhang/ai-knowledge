## MODIFIED Requirements

### Requirement: Agent Model Configuration Is Provider-Based
The system SHALL centralize Agent model and embedding provider configuration in an Agent config module. The config module MUST support provider-based configuration with defaults, provider definitions, provider type, base URL, API key environment variable name, model aliases, and embedding dimensions where applicable. Chat LLM clients and embedding providers MUST consume resolved provider configuration instead of parsing provider environment variables directly.

#### Scenario: Default provider is resolved
- **WHEN** no provider override is supplied for chat model generation
- **THEN** the config module resolves `model.default` as the active provider
- **AND** returns that provider's `type`, `base_url`, `api_key_env`, and selected model alias

#### Scenario: Default embedding provider is resolved
- **WHEN** vector indexing or hybrid retrieval needs an embedding provider and no embedding override is supplied
- **THEN** the config module resolves the configured embedding default provider
- **AND** returns that provider's `type`, `base_url`, `api_key_env`, selected embedding model alias, and expected embedding dimensions

#### Scenario: Provider override is resolved
- **WHEN** a provider override such as `deepseek` or `claude` is supplied
- **THEN** the config module resolves that provider instead of the relevant default provider
- **AND** returns that provider's configured model for the requested model alias

#### Scenario: Unknown provider is requested
- **WHEN** the caller requests a provider that is not present in the relevant provider map
- **THEN** the config module fails with `AgentError`
- **AND** the error does not fall back silently to another provider

### Requirement: Provider API Key Comes From Configured Environment Variable
The system SHALL read chat model and embedding provider credentials from each provider's configured `api_key_env` environment variable. The resolved API key MUST NOT be stored in config files or repository files.

#### Scenario: Provider API key exists
- **WHEN** the selected provider has `api_key_env = DEEPSEEK_API_KEY` and `process.env.DEEPSEEK_API_KEY` is set
- **THEN** the config module returns that environment value as the provider API key

#### Scenario: Embedding provider API key exists
- **WHEN** the selected embedding provider has `api_key_env = VOYAGE_API_KEY` and `process.env.VOYAGE_API_KEY` is set
- **THEN** the embedding provider client may use that environment value for embedding requests

#### Scenario: Provider API key is missing
- **WHEN** the selected provider's `api_key_env` is not set in the environment
- **THEN** the config module fails with `AgentError`
- **AND** the error identifies the missing environment variable name
- **AND** no API key value is written to repository files or command output

### Requirement: Agent Infrastructure Tests Do Not Call Real LLMs
The system SHALL test LLM client, prompt loading, and embedding provider behavior without real LLM or embedding network calls or real API keys in the default automated test contract.

#### Scenario: LLM client tests run
- **WHEN** the default test suite runs for `generate_text` or `generate_json`
- **THEN** it uses a mock SDK, fake transport, or fake client
- **AND** it does not require real provider API keys
- **AND** it does not send a network request

#### Scenario: Embedding provider tests run
- **WHEN** the default test suite runs for embedding provider config or embedding generation
- **THEN** it uses a fake embeddings adapter or fake provider
- **AND** it does not require real embedding provider API keys
- **AND** it does not send a network request

### Requirement: Real-LLM Smoke Tests Stay Outside Default Test Contract
系统 SHALL 将真实 LLM 和真实 embedding smoke test 与默认自动化测试链路分离。真实 smoke test MUST 使用单独脚本或命令入口显式触发，且 MUST NOT 成为默认 `pnpm test` 或 CI required check 的组成���分。

#### Scenario: Default test suite runs
- **WHEN** 开发者运行默认测试入口
- **THEN** 默认测试套件不调用真实 LLM provider 或真实 embedding provider
- **AND** does not require provider API key environment variables

#### Scenario: Explicit smoke command runs
- **WHEN** 开发者运行独立 smoke test 命令
- **THEN** 系统执行真实 LLM 或 embedding 集成检查
- **AND** 将该检查标记为本地显式、非阻塞验证路径

#### Scenario: Explicit embedding smoke is requested without provider key
- **WHEN** 用户显式运行 embedding smoke test，但环境中缺少所需 API key
- **THEN** smoke test MUST report that the required environment variable is missing
- **AND** MUST skip or exit without breaking the default automated test contract
