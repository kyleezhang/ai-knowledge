## Why

Issue 5 要在讨论前为 processed Source 生成初步理解草稿，让系统显式暴露当前理解、不确定性和讨论切口。前置的 Markdown processed artifacts 与 LLM client/provider/prompt loading 已具备后，本变更把它们组合成 `source understand` 工作流。

## What Changes

- 实现 `ai-knowledge source understand <source_id>` 的 P0 能力。
- 前置状态必须为 `Source.status = processed`，且 `processing_artifacts` 必须包含 `clean_text`、`segments`、`metadata`。
- 新增 `understand-agent`，使用 `src/agents/prompts/draft-understanding.md` 和 provider-based `LlmClient.generate_json`。
- Agent 输出只包含语义候选字段：`summary`、`key_points`、`uncertainties`、`discussion_starters`。
- Workflow 负责补 `generated_at`、写入 `source.draft_understanding`、清除 `last_error`、通过状态机执行 `processed -> understanding_ready`。
- LLM 调用失败或 schema 校验失败时，Source 进入 `failed`，写入 `last_error.stage = understanding`。
- 成功后 next action 为 `ai-knowledge source discuss <source_id>`。
- CLI 支持 `--show` 展示完整 draft，支持 `--json` 输出 workflow result。
- 非目标：不实现 discussion REPL、不确认 Source、不生成 Note、不写 index、不引入 PDF/自动采集/向量检索/Web UI。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `draft-understanding`: 细化 P0 `source understand` 的 agent 调用、prompt 使用、状态流转、失败语义和 CLI 输出契约。

## Impact

- Affected layers: domain, storage, agents, workflows, CLI, tests。
- Domain: 复用现有 `DraftUnderstandingSchema`，确认 workflow 补系统字段 `generated_at`。
- Storage: 读取 processed artifacts，通过 Source repo 保存更新后的 `source.json`。
- Agents: 新增 `understand-agent`，调用 `LlmClient.generate_json` 并使用 `draft-understanding.md` prompt。
- Workflows: 新增或完善 `understand_source_workflow`，负责状态校验、artifact 加载、agent 调用、失败记录和 next action。
- CLI: 新增 `source understand <source_id>`，支持 `--show` 与 `--json`。
- Tests: 覆盖 agent prompt/JSON schema、workflow 成功/失败路径、CLI smoke 和无真实 LLM 的 fake agent/client 注入。
