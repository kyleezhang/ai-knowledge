## Context

当前 P0 链路已经支持 Source ingest、processing、draft_understanding 和多轮 discussion REPL。Issue 7 是讨论阶段与 Note compose 阶段之间的明确人类确认门槛：只有当讨论已收敛并且用户明确执行 approve，Source 才能进入 `approved_for_note`，成为后续 Note 生成的合法输入。

该变更不涉及 LLM，不生成 Note，也不修改 discussion 内容；它是一个规则型 workflow/CLI gate，核心是状态校验、discussion_summary 校验和状态机流转。

## Goals / Non-Goals

**Goals:**

- 实现 `ai-knowledge source approve <source_id>`。
- 仅允许 `Source.status = discussing` 的 Source 进入 approve workflow。
- 要求 `discussion_summary.ready_for_approval = true`。
- 要求 `discussion_summary.confirmed_points` 非空。
- 通过状态机执行 `discussing -> approved_for_note`。
- 成功时设置 `discussion_summary.discussion_status = closed`。
- 成功后返回 next action：`ai-knowledge note compose <source_id>`。
- 支持 `--json`。
- 拒绝任何 force approve 语义。

**Non-Goals:**

- 不实现 Note compose。
- 不调用 Note Agent。
- 不渲染 Note Markdown。
- 不执行 QA / lint。
- 不创建 Index Entry。
- 不允许绕过 discussion convergence。

## Decisions

1. **Approval 是规则型 workflow，不调用 LLM。**
   - Decision: `approve_source_workflow` 只读取 Source、校验状态和 summary、执行状态流转并保存。
   - Rationale: Issue 7 是用户显式确认门槛，不需要模型参与；让 LLM 参与会模糊“用户确认”的边界。
   - Alternatives considered: 让 Agent 判断是否 approve。放弃原因是 spec 明确 agent readiness 不能替代用户确认。

2. **不支持 force approve。**
   - Decision: CLI 不提供 `--force`，workflow 也不接受 force 参数。
   - Rationale: 讨论未收敛时生成 formal Note 是核心禁区；force 参数会变成绕过治理门槛的后门。
   - Alternatives considered: 为管理员提供 force。放弃原因是 P0 单用户 CLI 仍需保持知识边界一致。

3. **workflow 负责关闭 discussion_status。**
   - Decision: 成功 approve 时，workflow 设置 `discussion_summary.discussion_status = closed`。
   - Rationale: `closed` 表示本轮确认所基于的 discussion_summary 已冻结用于 Note compose。
   - Alternatives considered: 保持 `ready_for_approval`。放弃原因是后续 Note compose 需要区分“可确认”与“已确认”。

4. **成功输出只提示 Note compose。**
   - Decision: next action 固定为 `ai-knowledge note compose <source_id>`。
   - Rationale: 下一阶段是 Issue 8，Note compose 只能从 `approved_for_note` Source 开始。

## Risks / Trade-offs

- [Risk] 用户误以为 `/approve` 已经完成最终批准。→ Mitigation: Issue 6 的 `/approve` 只提示 next command；本变更提供真正 `source approve` 命令。
- [Risk] ready flag 被错误设置。→ Mitigation: workflow 还要求 confirmed_points 非空，并保持后续 Note compose 只能使用 confirmed_points。
- [Risk] 未来想人工覆盖但 P0 禁止。→ Mitigation: 如确需人工 override，必须另开 OpenSpec change 更新治理规则。

## Migration Plan

- 已处于 `discussing` 且 `ready_for_approval = true` 的 Source 可执行 `source approve`。
- 不自动审批历史 Source。
- 不迁移 Note 或 Index。

## Open Questions

- 无。Issue 7 acceptance criteria 已明确禁止 force approve。

## Verification Strategy

- 运行 OpenSpec validation。
- 运行 `pnpm typecheck`、`pnpm test`、`pnpm lint`、`pnpm format:check`、`pnpm build`。
- Workflow tests 覆盖成功 approve、非 discussing 状态、not ready、confirmed_points 为空。
- CLI tests 覆盖人类可读输出、`--json` 输出和错误输出。
