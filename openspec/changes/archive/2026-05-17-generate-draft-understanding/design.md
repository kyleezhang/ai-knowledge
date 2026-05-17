## Context

P0 主动学习链路已经具备 Markdown ingest、source processing、provider-based LLM client 与 prompt loading。`draft_understanding` 是 processed artifacts 之后、discussion 之前的第一份结构化理解草稿，它必须服务于讨论，而不能被当作正式知识或直接生成 Note。

本变更把 Source processed artifacts、Understand Agent、LLM JSON schema 校验、Source 状态机和 CLI 组合为 `ai-knowledge source understand <source_id>`。

## Goals / Non-Goals

**Goals:**

- 仅允许 `Source.status = processed` 的 Source 生成 `draft_understanding`。
- 读取 `processing_artifacts.clean_text`、`segments`、`metadata` 作为 Understand Agent 输入。
- 使用 `draft-understanding.md` prompt 和 `LlmClient.generate_json` 生成候选语义字段。
- workflow 补 `generated_at`，写入 `source.draft_understanding`，执行 `processed -> understanding_ready`。
- LLM 或 schema 失败时写 `last_error.stage = understanding`，Source 进入 `failed`。
- CLI 支持 `source understand <source_id>`、`--show` 和 `--json`。
- 所有测试使用 fake LLM client/agent，不发真实 LLM 请求。

**Non-Goals:**

- 不实现 discussion REPL 或 discussion_summary 更新。
- 不执行 Source approval，不生成 Note，不渲染 Markdown Note，不写 index。
- 不把 draft_understanding 作为 approved knowledge。
- 不引入 PDF、自动采集、向量检索、Web UI 或数据库。

## Decisions

1. **Understand Agent 只生成语义候选字段。**
   - Decision: `understand_agent` 返回 `summary`、`key_points`、`uncertainties`、`discussion_starters`，不返回 `generated_at`。
   - Rationale: `generated_at` 是系统时间字段，应由 workflow 统一补充，避免模型伪造。
   - Alternatives considered: 让 LLM 输出完整 `DraftUnderstanding`。放弃原因是会把系统字段交给模型，破坏可验证边界。

2. **Workflow 负责读取 artifacts 与组织 Agent 输入。**
   - Decision: Agent 接收 workflow 提供的 Source title、metadata、segments、clean_text 摘要和 `input_truncated` 标记，不直接访问 storage。
   - Rationale: Agent 层不得读写文件或访问 repo，storage 边界由 workflow 控制。
   - Alternatives considered: Agent 根据 source_id 自行读取 artifacts。放弃原因是会让 Agent 越过 storage/workflow 边界。

3. **P0 使用简单 token budget / 字符预算截断。**
   - Decision: workflow 优先传入 metadata 和 segments，并可传 clean_text 摘要；超出预算时设置 `input_truncated = true`。
   - Rationale: P0 不引入复杂 context management，但 prompt 要能显式反映截断风险。
   - Alternatives considered: 无条件传完整 clean_text。放弃原因是长文档可能导致上下文过大，且 specs/implementation.md 建议优先使用 segments。

4. **失败后 Source 进入 failed。**
   - Decision: LLM 调用、JSON parse、schema 校验或 artifact 读取失败时，workflow 尽量 transition 到 `failed` 并写 `last_error.stage = understanding`。
   - Rationale: `understanding_ready` 只能代表已得到可讨论草稿；失败状态能让用户通过 `source show` 定位问题。
   - Alternatives considered: 保持 `processed` 并返回错误。放弃原因是会丢失失败阶段信息，不符合 Issue 5 acceptance criteria。

5. **CLI `--show` 只影响展示，不改变 workflow 输出。**
   - Decision: workflow 总是返回 Source summary 和 draft；CLI 默认展示摘要，`--show` 展示完整 draft_understanding。
   - Rationale: CLI 只负责展示，不应改变业务行为。

## Risks / Trade-offs

- [Risk] LLM 输出非 JSON 或不满足 schema。→ Mitigation: `generate_json` 抛 `AgentError`，workflow 失败并写 `last_error.stage = understanding`，不静默修复。
- [Risk] 输入过长导致上下文过大。→ Mitigation: workflow 使用简单预算截断，并把 `input_truncated` 传给 Agent，prompt 要求在 uncertainties 中体现风险。
- [Risk] draft 被误当作正式知识。→ Mitigation: spec、prompt 和 workflow 都明确 draft 仅用于讨论；Note compose 仍依赖 discussion approval。
- [Risk] 真实 LLM 测试不稳定。→ Mitigation: 单元/集成测试全部使用 fake agent/client，真实连通性只作为人工验证。

## Migration Plan

- 已存在 `processed` Source 可直接执行 `ai-knowledge source understand <source_id>`。
- 已处于其他状态的 Source 不自动生成或重写 draft。
- 不迁移历史 Note 或 Index。

## Open Questions

- related approved Notes 检索在 P0 是否立即接入；建议本变更先预留输入字段，不强制实现检索。
- clean_text 截断预算的具体大小可先用保守常量，后续根据真实材料长度调整。

## Verification Strategy

- 运行 OpenSpec validation。
- 运行 `pnpm typecheck`、`pnpm test`、`pnpm lint`、`pnpm format:check`、`pnpm build`。
- Agent tests 覆盖 prompt 加载、`generate_json` 调用和 schema failure。
- Workflow tests 覆盖成功路径、非 processed 状态拒绝、missing artifacts、agent failure、schema failure 写入 failed。
- CLI tests 覆盖 human-readable、`--show`、`--json` 和错误输出。
