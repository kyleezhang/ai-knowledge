# llm-client-prompt-loading Specification

## Purpose

TBD - created by archiving change llm-client-prompt-loading. Update Purpose after archive.

## Requirements
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

### Requirement: Agent Layer Uses Anthropic SDK Provider Config
The system SHALL provide an Agent-layer LLM client built around `@anthropic-ai/sdk`. The client MUST construct the SDK from resolved provider config. For provider type `anthropic_compatible`, it MUST pass `apiKey` and `baseURL`. For provider type `anthropic`, it MUST pass `apiKey` and MAY pass `baseURL` when configured. Requests MUST use the resolved model alias unless a concrete model override is supplied.

#### Scenario: Anthropic-compatible provider is used
- **WHEN** the selected provider has `type = anthropic_compatible`
- **THEN** the LLM client creates an Anthropic SDK client with the provider API key
- **AND** the LLM client uses the provider `base_url` as SDK `baseURL`
- **AND** requests use the selected provider model alias by default

#### Scenario: Anthropic provider is used
- **WHEN** the selected provider has `type = anthropic`
- **THEN** the LLM client creates an Anthropic SDK client with the provider API key
- **AND** requests use the selected provider model alias by default

### Requirement: CLI Model Option Selects Provider
The system SHALL allow future CLI commands that invoke Agents to accept `--model <provider>` as a provider selector. The option value MUST map to `model.providers.<provider>` rather than being treated as a raw model ID.

#### Scenario: CLI selects deepseek provider
- **WHEN** a future Agent-backed CLI command is run with `--model deepseek`
- **THEN** the workflow passes `deepseek` as the provider override to the Agent layer
- **AND** the Agent layer resolves the concrete chat model from `model.providers.deepseek.models.chat`

#### Scenario: CLI omits model option
- **WHEN** a future Agent-backed CLI command omits `--model`
- **THEN** the workflow uses `model.default` from the project config

### Requirement: LLM Client Exposes Text and JSON Generation
The system SHALL expose a `LlmClient` interface with `generate_text` and `generate_json` operations. `generate_json` MUST accept a Zod schema and MUST return only data that passes that schema.

#### Scenario: Text generation succeeds
- **WHEN** an Agent calls `generate_text` with system prompt, user prompt, model, and temperature inputs
- **THEN** the client sends a model request
- **AND** returns the generated text content

#### Scenario: JSON generation succeeds
- **WHEN** an Agent calls `generate_json` and the model returns valid JSON matching the supplied Zod schema
- **THEN** the client returns the parsed typed value

#### Scenario: JSON parse fails
- **WHEN** an Agent calls `generate_json` and the model output is not valid JSON
- **THEN** the client throws `AgentError`
- **AND** the error code is `LLM_OUTPUT_PARSE_FAILED`

#### Scenario: JSON schema validation fails
- **WHEN** an Agent calls `generate_json` and the parsed JSON does not satisfy the supplied Zod schema
- **THEN** the client throws `AgentError`
- **AND** the error code is `LLM_OUTPUT_SCHEMA_FAILED`

### Requirement: Agent Errors Are Classified
The system SHALL define `AgentError` with stable error codes for LLM call failures, LLM output parse failures, LLM output schema failures, prompt load failures, and context size failures.

#### Scenario: LLM call fails
- **WHEN** the underlying SDK call fails
- **THEN** the Agent layer throws `AgentError`
- **AND** the error code is `LLM_CALL_FAILED`

#### Scenario: Prompt loading fails
- **WHEN** the Agent layer cannot load a required prompt
- **THEN** the Agent layer throws `AgentError`
- **AND** the error code is `PROMPT_LOAD_FAILED`

### Requirement: Prompts Are Loaded From Versioned Prompt Directory
The system SHALL load Agent prompts from `src/agents/prompts/`. Prompt loading MUST reject absolute paths and path traversal attempts, and prompt files MUST be version-controlled project files.

#### Scenario: Prompt file exists
- **WHEN** the Agent layer loads an existing prompt by name from `src/agents/prompts/`
- **THEN** the loader returns the prompt text

#### Scenario: Prompt file is missing
- **WHEN** the Agent layer loads a prompt name that does not exist
- **THEN** the loader throws `AgentError`
- **AND** the error code is `PROMPT_LOAD_FAILED`

#### Scenario: Prompt name attempts path traversal
- **WHEN** the Agent layer loads a prompt name containing `..` or an absolute path
- **THEN** the loader rejects the request
- **AND** no file outside `src/agents/prompts/` is read

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

### Requirement: Local Smoke Tests Require Explicit Provider Credentials
系统 SHALL 为本地真实 LLM 和真实 embedding smoke test 定义显式 provider 凭证前置条件。对于默认 deepseek provider，本地 smoke test 仅在检测到 `DEEPSEEK_API_KEY` 时才可运行；对于默认 Voyage embedding provider，涉及 vector indexing 或 hybrid vector signal 的 smoke test 仅在检测到 `VOYAGE_API_KEY` 时才可运行。若缺失所需凭证，该 smoke test MUST 默认跳过或以非阻塞方式退出，而不得让默认测试链路失败。

#### Scenario: Smoke test runs with provider keys present
- **WHEN** 用户显式运行本地 smoke test，且环境中存在 `DEEPSEEK_API_KEY` 和 `VOYAGE_API_KEY`
- **THEN** smoke test MAY 初始化真实 chat provider client 和真实 embedding provider client
- **AND** use the configured providers to exercise the target workflow

#### Scenario: Smoke test is requested without provider key
- **WHEN** 用户显式运行本地 smoke test，但环境中缺少 `DEEPSEEK_API_KEY` 或 `VOYAGE_API_KEY`
- **THEN** smoke test MUST report that the required environment variable is missing
- **AND** MUST skip or exit without breaking the default automated test contract

### Requirement: Real-LLM Smoke Tests Stay Outside Default Test Contract
系统 SHALL 将真实 LLM 和真实 embedding smoke test 与默认自动化测试链路分离。真实 smoke test MUST 使用单独脚本或命令入口显式触发，且 MUST NOT 成为默认 `pnpm test` 或 CI required check 的组成部分。

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
