## Why

Issue 4 需要为后续 `understand`、`discuss`、`note compose`、`answer` 等 Agent workflow 建立统一 LLM 调用基础设施。没有统一的 LLM Client、Prompt 加载和结构化输出校验，后续 Agent 容易绕过 Zod 校验、混淆职责边界，或把不可验证的模型输出推进工作流。

## What Changes

- 引入 P0 Agent 层基础设施：provider-based model config、`LlmClient` 接口、Anthropic SDK client、prompt loader、`generate_json` 和 `AgentError`。
- 使用 `@anthropic-ai/sdk`，provider 配置支持 `anthropic_compatible` 与 `anthropic` 类型。
- API key 只从 provider 声明的 `api_key_env` 对应环境变量读取，不写入配置文件或仓库。
- 默认 provider 为 `deepseek`，默认 chat 模型为 `deepseek-v4-pro`。
- 为后续 Agent-backed CLI 命令预留 `--model <provider>` 语义，用于选择 provider 而不是 raw model id。
- `generate_json` 接收 Zod schema，解析并校验 LLM JSON 输出；schema 校验失败时抛出 `AgentError`，code 为 `LLM_OUTPUT_SCHEMA_FAILED`。
- Prompt 文件从 `src/agents/prompts/` 加载，prompt 本身纳入版本管理。
- 单元测试使用 mock LLM transport/client，不依赖真实 LLM 调用。
- 非目标：不实现具体 Understand/Discussion/Note/Answer Agent，不推进 Source/Note 状态，不生成 `draft_understanding`、`discussion_summary`、`Note` 或 answer。

## Capabilities

### New Capabilities

- `llm-client-prompt-loading`: 定义 Agent 层如何加载 prompt、调用 Anthropic-compatible LLM、校验结构化 JSON 输出并报告 AgentError。

### Modified Capabilities

- 无。

## Impact

- Affected layers: agents, tests, dependencies。
- Dependencies: 新增运行时依赖 `@anthropic-ai/sdk`。
- Agents: 新增 `src/agents/config.ts`、`src/agents/llm-client.ts`、`src/agents/prompt-loader.ts`、`src/agents/errors.ts`、`src/agents/types.ts` 与 `src/agents/prompts/`。
- Workflows/CLI: 本变更不接入具体 Agent workflow，但定义后续 Agent-backed CLI 的 `--model <provider>` 选择语义。
- Tests: 覆盖 prompt 加载、缺失 prompt 错误、`generate_json` 成功解析、JSON parse 失败、Zod schema 失败、LLM 调用失败。
- Security: 不落盘 API key，不在测试中要求真实 `GATEWAY_API_KEY`。
