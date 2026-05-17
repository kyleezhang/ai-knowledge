## 1. Domain and Schemas

- [x] 1.1 确认 `DraftUnderstandingSchema` 包含 `summary`、`key_points`、`uncertainties`、`discussion_starters`、`generated_at`。
- [x] 1.2 新增 Understand Agent 输出候选 schema，只包含 `summary`、`key_points`、`uncertainties`、`discussion_starters`，不包含 `generated_at`。
- [x] 1.3 补充 domain/agent schema tests，覆盖候选输出缺字段、类型错误和 workflow 补 `generated_at` 的边界。

## 2. Storage Artifact Reads

- [x] 2.1 在 artifact store 中补充读取 `processed/clean_text.md` 的能力。
- [x] 2.2 在 artifact store 中补充读取 `processed/segments.json` 与 `processed/metadata.json` 的能力。
- [x] 2.3 确保 artifact 读取使用 Source storage helper，不手写 `knowledge/` 路径，并复用 path traversal 防护。
- [x] 2.4 添加 storage tests，覆盖 processed artifacts 读取成功、缺失 artifact 报错和 JSON parse/schema 错误。

## 3. Understand Agent

- [x] 3.1 实现 `src/agents/understand-agent.ts`，加载 `draft-understanding.md` prompt。
- [x] 3.2 定义 `UnderstandAgentInput`，包含 Source title、metadata、segments、可选 clean text 摘要、可选 related notes 和 `input_truncated`。
- [x] 3.3 调用 `LlmClient.generate_json`，使用 Understand Agent 输出候选 schema 校验返回值。
- [x] 3.4 组织结构化 user prompt，清晰区分 Source metadata、segments、clean text summary 和 truncation 标记。
- [x] 3.5 添加 understand-agent tests，使用 fake `LlmClient`，覆盖 prompt 加载、输入组织、成功返回和 schema/LLM failure。

## 4. Workflow

- [x] 4.1 实现 `understand_source_workflow`：加载 Source、校验当前状态为 `processed`、校验 processed artifacts 完整。
- [x] 4.2 workflow 读取 processed artifacts，按预算组织 Understand Agent 输入，必要时设置 `input_truncated = true`。
- [x] 4.3 成功路径中 workflow 补 `generated_at`，写入 `source.draft_understanding`，清除 `last_error`。
- [x] 4.4 成功路径通过状态机执行 `processed -> understanding_ready`，保存 Source，并返回 next action `ai-knowledge source discuss <source_id>`。
- [x] 4.5 失败路径中尽量 transition 到 `failed`，写入 `last_error.stage = understanding`、错误消息和 `occurred_at`。
- [x] 4.6 添加 workflow tests，覆盖成功、非 processed 状态拒绝、artifact 缺失、agent failure、schema failure 和 failed 状态写入。

## 5. CLI

- [x] 5.1 新增 `ai-knowledge source understand <source_id>` 命令，CLI 只解析参数、调用 workflow 并展示结果。
- [x] 5.2 支持 `--show`，成功后展示完整 `draft_understanding`。
- [x] 5.3 支持 `--json`，输出 workflow result，包含 generated `draft_understanding` 和 next action。
- [x] 5.4 人类可读默认输出展示 Source id、status、draft summary 和 next action，不默认输出完整 processed artifact 正文。
- [x] 5.5 添加 CLI smoke tests，覆盖默认输出、`--show`、`--json` 和错误输出。

## 6. Verification

- [x] 6.1 运行 OpenSpec 校验，确认 `generate-draft-understanding` change 有效。
- [x] 6.2 运行 TypeScript typecheck。
- [x] 6.3 运行 Vitest 测试套件。
- [x] 6.4 运行 ESLint 和 Prettier 检查。
- [x] 6.5 运行 build。
- [x] 6.6 使用 fake 或测试 fixture 跑通 `ingest -> process -> understand`，确认状态到 `understanding_ready` 且 next action 指向 `source discuss`。
