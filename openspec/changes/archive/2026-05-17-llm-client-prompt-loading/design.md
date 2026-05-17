## Context

P0 主动学习闭环已经进入 Source processing 之后的 Agent 基础设施阶段。后续 `source understand`、`source discuss`、`note compose`、`answer` 都需要调用 LLM，但 Agent 层必须保持边界清晰：只生成结构化候选内容，不写文件、不改状态、不创建索引、不跳过 Zod 校验。

当前仓库尚未接入 LLM SDK，也没有统一 prompt loader 或 AgentError。该变更先建立可测试、可注入、可复用的 LLM Client 与 prompt 加载基础设施，为 Issue 5 及后续 Agent 工作流服务。

## Goals / Non-Goals

**Goals:**

- 新增 `@anthropic-ai/sdk` 运行时依赖。
- 提供 `LlmClient` 接口，至少支持 `generate_text` 与 `generate_json`。
- 默认 client 使用 Anthropic SDK，`baseURL = https://api.deepseek.com/anthropic`，默认模型 `deepseek-v4-pro`。
- API key 只从 `process.env.GATEWAY_API_KEY` 读取。
- `generate_json` 接收 Zod schema，完成 JSON parse 与 schema parse，失败时抛 `AgentError`。
- 新增 prompt loader，从 `src/agents/prompts/` 读取版本化 prompt 文件。
- 定义 `AgentError` 与稳定错误码，供 workflow 后续转换为 `AGENT_FAILED`。
- 测试不依赖真实 LLM；通过 mock SDK/transport 或 fake client 验证行为。

**Non-Goals:**

- 不实现 `understand-agent`、`discussion-agent`、`note-agent`、`answer-agent` 的业务逻辑。
- 不接入任何 workflow 或 CLI 命令。
- 不读取或写入 Source/Note/Index 文件。
- 不新增 PDF、自动采集、向量检索、Web UI 或数据库能力。
- 不把 API key 写入 `ai-knowledge.config.json` 或任何 repo 文件。

## Decisions

1. **使用 Anthropic SDK + Anthropic-compatible endpoint。**
   - Decision: 默认实现基于 `@anthropic-ai/sdk`，通过 `baseURL = https://api.deepseek.com/anthropic` 调用 DeepSeek compatible endpoint。
   - Rationale: 与 `specs/issues.md` Issue 4 和 `specs/implementation.md` 技术基线一致，后续 Agent 可统一使用 Anthropic Messages API 语义。
   - Alternatives considered: 直接使用 `fetch`。放弃原因是会重复处理 SDK 已覆盖的请求格式与错误边界，也偏离 spec。

2. **Agent 层提供接口，workflow 注入 client。**
   - Decision: 定义 `LlmClient` interface，并提供默认 `create_llm_client`；后续 agents/workflows 可传入 fake client 测试。
   - Rationale: 单元测试不能依赖真实 LLM，接口化能让后续 workflow 使用 fake agents/fake clients。
   - Alternatives considered: 导出单例 client。放弃原因是单例不利于测试，也容易在 import 时读取环境变量。

3. **`generate_json` 负责 parse + Zod schema 校验。**
   - Decision: LLM 返回文本后，`generate_json` 只接受合法 JSON，并用调用方传入的 Zod schema 校验。
   - Rationale: LLM 输出必须结构化且可验证，不能静默修复或猜测模型意图。
   - Alternatives considered: 尝试从 Markdown code block 中宽松提取 JSON。放弃原因是会引入静默修复风险；P0 先要求模型输出严格 JSON。

4. **错误使用 `AgentError` 稳定分类。**
   - Decision: 定义 `LLM_CALL_FAILED`、`LLM_OUTPUT_PARSE_FAILED`、`LLM_OUTPUT_SCHEMA_FAILED`、`PROMPT_LOAD_FAILED` 等错误码。
   - Rationale: workflow 只需把 AgentError 转为 `AGENT_FAILED`，细节放入 details/cause。
   - Alternatives considered: 直接抛原始 Error。放弃原因是调用层难以区分网络错误、JSON parse 错误和 schema 错误。

5. **Agent model config 使用 provider-based 结构。**
   - Decision: 新增 `src/agents/config.ts`，解析 `model.default` 和 `model.providers`，provider 包含 `type`、`base_url`、`api_key_env` 和 `models`；`llm-client.ts` 只消费解析后的 provider config。
   - Rationale: 模型供应商、base URL、API key env 和模型别名属于配置契约，不应在代码里写死优先级。这样后续 `--model deepseek` 可选择 provider，而不是把 CLI 参数当成 raw model id。
   - Alternatives considered: 继续使用 `ANTHROPIC_*`/`DEEPSEEK_*` 环境变量优先级。放弃原因是多 provider 行为隐式、难扩展，且无法表达 provider 内的模型别名。

6. **`--model` 表示 provider selector，而不是 raw model id。**
   - Decision: 后续 Agent-backed CLI 命令接收 `--model <provider>`，workflow 将 provider 名传给 Agent config resolver，由 resolver 选择 `models.chat`。
   - Rationale: 用户意图是切换供应商配置，例如 `deepseek` 或 `claude`，而不是在每个命令里输入具体模型字符串。
   - Alternatives considered: `--model` 直接传 raw model id。放弃原因是无法同时切换 base URL 和 API key env，也会把 provider 选择逻辑推到 CLI/workflow 层。

7. **Prompt loader 限定在 `src/agents/prompts/`。**
   - Decision: prompt 名称只允许 basename，不接受 absolute path 或 `..`，读取路径固定来自 agents prompt directory。
   - Rationale: prompt 属于产品逻辑，必须版本化且避免 path traversal。
   - Alternatives considered: 从任意路径加载 prompt。放弃原因是会扩大安全边界，且不利于 prompt 版本治理。

## Risks / Trade-offs

- [Risk] 严格 JSON 输出要求可能让模型偶发返回非 JSON 导致失败。→ Mitigation: P0 明确失败并抛 `LLM_OUTPUT_PARSE_FAILED`，不静默修复；后续可通过 prompt 优化降低失败率。
- [Risk] Anthropic SDK 返回内容块结构可能随 SDK 类型变化。→ Mitigation: 封装在 `llm-client.ts` 内，外部只依赖 `LlmClient` 接口。
- [Risk] import 时读取环境变量会让测试或无 key 环境失败。→ Mitigation: `create_llm_client` 调用时读取 env，测试使用 fake transport/client，不在模块加载时强制读取。
- [Risk] prompt loader 如果允许任意 path 会造成越界读取。→ Mitigation: 限制 prompt name，不允许 absolute path 或 `..`。

## Migration Plan

- 这是新增 Agent 基础设施，不迁移已有 Source/Note/Index 数据。
- 新增依赖后需要更新 lockfile。
- 后续 Issue 5 可直接复用 `load_prompt`、`LlmClient.generate_json` 与 `AgentError`。

## Open Questions

- P0 是否立即支持按 agent 覆盖模型名（`understand_model`、`discussion_model` 等）；建议本变更只定义类型和默认模型，具体 agent 使用时再接入。
- 是否需要支持 JSON mode / tool use；建议 P0 不引入 tool calling，先使用严格文本 JSON 输出。

## Verification Strategy

- 运行 OpenSpec validation。
- 运行 `pnpm typecheck`、`pnpm test`、`pnpm lint`、`pnpm format:check`、`pnpm build`。
- 单元测试覆盖 prompt loader 成功/失败、路径约束、`generate_json` 成功、JSON parse 失败、schema parse 失败、LLM call 失败。
- 确认测试不要求真实 `GATEWAY_API_KEY`，也不发起真实网络请求。
