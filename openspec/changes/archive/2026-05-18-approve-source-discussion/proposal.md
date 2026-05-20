## Why

Issue 7 要把已收敛的 Source 讨论从 `discussing` 推进到 `approved_for_note`，为后续 Note compose 提供明确的人类确认门槛。没有该门槛，系统可能把未确认讨论或 agent 建议误当成可落笔的正式知识输入。

## What Changes

- 实现 `ai-knowledge source approve <source_id>`。
- 前置状态必须为 `Source.status = discussing`。
- 必须满足 `discussion_summary.ready_for_approval = true`。
- 必须满足 `discussion_summary.confirmed_points` 非空。
- 成功时通过状态机执行 `discussing -> approved_for_note`。
- 成功时设置 `discussion_summary.discussion_status = closed`。
- 不支持 `--force` 或任何强制 approve 绕过。
- 成功后 next action 为 `ai-knowledge note compose <source_id>`。
- 支持 `--json` 输出。
- 非目标：不生成 Note、不调用 Note Agent、不渲染 Markdown、不执行 QA、不写 index。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `discussion-convergence`: 细化用户显式批准已收敛讨论的前置条件，以及禁止 agent-only approval。
- `source-lifecycle`: 细化 `source approve` 命令如何将 Source 从 `discussing` 推进到 `approved_for_note`。

## Impact

- Affected layers: domain, workflows, CLI, tests。
- Domain: 复用 Source state machine 和 Source invariant：`approved_for_note` 必须 ready 且有 confirmed points。
- Workflow: 新增或完善 `approve_source_workflow`，负责状态校验、discussion_summary 校验、状态流转、关闭讨论和 next action。
- CLI: 新增 `source approve <source_id>`，支持人类可读输出与 `--json`。
- Tests: 覆盖成功批准、非 discussing 状态拒绝、not ready 拒绝、confirmed_points 为空拒绝、无 force 参数、JSON 输出和 next action。
