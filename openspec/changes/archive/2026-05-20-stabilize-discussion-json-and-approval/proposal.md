## Why

当前 `source discuss` 阶段把自然语言回复与结构化 `discussion_summary_update` 强绑定到同一次严格 JSON 输出里，导致正常对话中会偶发 `LLM output is not valid JSON`，直接中断讨论流程。同时，`source approve` 当前过度依赖模型主动把 `ready_for_approval` 置为 `true`，使得用户已经明确收敛结论时仍然难以完成 approve，这两点都明显偏离 P0 预期的 CLI 交互体验。

## What Changes

- 为 discussion 阶段增加最小 JSON 容错策略：当模型输出不是裸 JSON 时，系统可尝试从受限格式中提取单个 JSON 对象，再继续执行 schema 校验；仍失败时才报 `AGENT_FAILED`。
- 收紧容错边界：只接受单个可提取 JSON 载荷，不放松 `DiscussionAgentOutputSchema`，不允许把非结构化自由文本当作有效状态更新。
- 调整 discussion / approval 的短期判定规则：当用户显式执行 approve 动作，且 `confirmed_points` 已非空、讨论对象仍处于 `discussing` 时，系统应允许用户确认优先于模型的 `ready_for_approval` 建议信号。
- 改进 `/approve` 与 `source approve` 的阻塞提示，明确区分：缺少 `confirmed_points`、仍有待确认问题、或只是尚未达到建议 ready 状态。
- 新增回归测试，覆盖 recoverable JSON 输出、不可恢复 JSON 输出、用户显式 approve 成功、以及仍应拒绝的 approval 场景。
- 本变更保持 P0 范围，不引入 discussion 架构重构、多阶段 agent 编排、Web UI、数据库或新的输入来源。

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `discussion-convergence`: 调整 discussion 结构化输出容错与 approval readiness / user confirmation 行为。
- `source-lifecycle`: 调整 `source approve` 的可接受前置条件与用户可见错误反馈。
- `llm-client-prompt-loading`: 为 `generate_json` 增加受限 JSON 提取容错，但保持 schema 校验为硬门槛。

## Impact

- Affected layers: agents, workflows, CLI, tests.
- Affected contracts: discussion agent JSON parsing behavior, approval gating semantics, and CLI discussion/approval feedback.
- No change to `Source` / `Note` / `Index Entry` 主真相边界；不改变后续 `note compose -> lint -> approve -> index -> answer` 主链路。
- Long-term discussion architecture refactor remains out of scope and should be tracked separately in `specs/issues.md`.
