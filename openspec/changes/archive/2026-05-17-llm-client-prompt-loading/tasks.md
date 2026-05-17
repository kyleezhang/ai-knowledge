## 1. Dependencies and Structure

- [x] 1.1 添加运行时依赖 `@anthropic-ai/sdk`，并更新 lockfile。
- [x] 1.2 创建 `src/agents/` 基础目录结构，包括 `config.ts`、`types.ts`、`errors.ts`、`llm-client.ts`、`prompt-loader.ts` 和 `prompts/`。
- [x] 1.3 创建 P0 prompt 文件占位内容，至少包含 `draft-understanding.md`、`discussion-reply.md`、`compose-note-json.md`、`answer-grounded.md`。
- [x] 1.4 将模型配置重构为 provider-based 结构，支持 `model.default`、`model.providers`、`type`、`base_url`、`api_key_env` 和 `models.chat`。

## 2. Agent Types and Errors

- [x] 2.1 定义 `AgentError` 与错误码：`LLM_CALL_FAILED`、`LLM_OUTPUT_PARSE_FAILED`、`LLM_OUTPUT_SCHEMA_FAILED`、`PROMPT_LOAD_FAILED`、`CONTEXT_TOO_LARGE`。
- [x] 2.2 定义 `LlmClient`、`GenerateTextInput`、`GenerateTextResult`、`GenerateJsonInput<T>` 等 Agent 层类型。
- [x] 2.3 确保 Agent types 不依赖 storage、workflow、CLI 或 domain 状态机。
- [x] 2.4 定义 provider config 类型和 resolved provider config 类型，不在类型层存储明文 secret。

## 3. Prompt Loading

- [x] 3.1 实现 `load_prompt(prompt_name)`，只从 `src/agents/prompts/` 加载 prompt。
- [x] 3.2 拒绝 absolute path、包含 `..` 的 prompt name，以及越过 prompts 目录的解析结果。
- [x] 3.3 缺失或读取失败时抛 `AgentError`，code 为 `PROMPT_LOAD_FAILED`。
- [x] 3.4 添加 prompt loader tests，覆盖成功加载、缺失 prompt、absolute path 和 path traversal。

## 4. Provider Config and LLM Client

- [x] 4.1 实现 provider resolver，默认选择 `model.default`，并支持调用方传入 provider override。
- [x] 4.2 provider resolver 从 selected provider 的 `api_key_env` 读取 API key，缺失时抛 `AgentError`。
- [x] 4.3 实现 Anthropic SDK client factory，从 resolved provider config 传入 `apiKey`、`baseURL` 和默认模型。
- [x] 4.4 实现 `generate_text`，封装 SDK messages 调用并返回文本内容。
- [x] 4.5 实现 `generate_json`，调用 `generate_text` 后执行 JSON.parse 与 Zod schema parse。
- [x] 4.6 将 SDK 调用失败包装为 `AgentError: LLM_CALL_FAILED`。
- [x] 4.7 将 JSON.parse 失败包装为 `AgentError: LLM_OUTPUT_PARSE_FAILED`。
- [x] 4.8 将 Zod schema 失败包装为 `AgentError: LLM_OUTPUT_SCHEMA_FAILED`，不静默修复输出。

## 5. Tests

- [x] 5.1 添加 LLM client tests，使用 fake Anthropic messages API 或 fake transport，不发起真实网络请求。
- [x] 5.2 覆盖 `generate_text` 成功返回文本内容。
- [x] 5.3 覆盖 `generate_json` 成功解析并通过 Zod schema。
- [x] 5.4 覆盖 LLM call failure、invalid JSON、schema validation failure 和 API key 缺失。
- [x] 5.5 确认测试不要求真实 provider API key。
- [x] 5.6 添加 Agent config tests，覆盖默认 provider、provider override、unknown provider、missing `api_key_env`、missing env var 和 model alias 解析。

## 6. CLI Integration Contract

- [x] 6.1 在 Agent config 类型中保留 provider selector 输入，供后续 CLI `--model <provider>` 透传使用。
- [x] 6.2 不在本变更中接入具体 workflow/CLI 命令，只通过 spec 明确后续 Agent-backed CLI 的 `--model` 语义。

## 7. Verification

- [x] 7.1 运行 OpenSpec 校验，确认 `llm-client-prompt-loading` change 有效。
- [x] 7.2 运行 TypeScript typecheck。
- [x] 7.3 运行 Vitest 测试套件。
- [x] 7.4 运行 ESLint 和 Prettier 检查。
- [x] 7.5 运行 build，确认新增 Agent 基础设施可编译。
