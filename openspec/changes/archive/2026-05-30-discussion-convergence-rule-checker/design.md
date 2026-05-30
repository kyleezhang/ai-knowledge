## Context

讨论收敛是 Source 从 draft understanding 进入正式 Note 之前的关键 gate。现有 workflow 已有 `discussion_summary.ready_for_approval`、`confirmed_points`、`open_questions`、`unresolved_issues` 等结构化字段，但 readiness 的判断容易分散在 Agent 输出、discussion workflow 和 approval workflow 中。

本设计引入一个纯 domain 的 deterministic convergence checker：它不调用 LLM、不写文件、不改变状态，只根据 Source 与 `discussion_summary` 返回是否可批准以及失败原因。workflow 层使用该结果规范化 discussion 更新和 approval gate。

## Goals / Non-Goals

**Goals:**

- 提供可复用的 convergence checker，统一判断 Source 是否满足 approval readiness。
- 在 discussion workflow 更新 `discussion_summary` 后，用 checker 防止不满足规则的 `ready_for_approval = true` 被持久化。
- 在 source approval workflow 中使用 checker，返回明确失败原因。
- 保持 Source 状态转换仍通过 domain state machine。
- 增加 domain/workflow/CLI 测试，覆盖 readiness truth table 与拒绝原因。

**Non-Goals:**

- 不新增 LLM 收敛判断，也不让 Agent 直接批准 Source。
- 不自动把 Source 转为 `approved_for_note`。
- 不生成 Note、不修改 Note QA/index gates。
- 不改变 discussion log 存储格式。
- 不新增 Web UI、数据库、向量检索或 Candidate 相关能力。

## Decisions

1. **checker 放在 domain 层。**
   - Rationale: readiness 规则是对象状态与字段不变量，不应依赖 storage、CLI 或 Agent。
   - Alternative considered: 只在 approval workflow 内部判断。该方案短期简单，但会继续让 discuss 与 approve 的 readiness 语义分散。

2. **checker 返回 structured result，而不是只返回 boolean。**
   - Rationale: CLI 和 workflow 测试需要知道失败原因，例如 still has open questions、unresolved issues、missing confirmed points。
   - Alternative considered: 抛异常。该方案不适合常规业务分支，也不方便在 discussion workflow 中做 normalization。

3. **discussion workflow normalize readiness，approval workflow enforce readiness。**
   - Rationale: discussion 阶段可以保存 open summary，但不能把不满足规则的 summary 标记为 ready；approval 阶段必须拒绝未收敛 Source。
   - Alternative considered: 只在 approval 时检查。该方案能防止最终错误，但 `source show` 会展示误导性的 `ready_for_approval = true`。

4. **checker 不判断用户是否已经显式批准。**
   - Rationale: checker 只判断讨论是否可批准；显式用户批准仍由 `source approve` 命令和 Source 状态转换表达。
   - Alternative considered: 把 explicit approval 也放进 checker。该方案会混淆“ready for approval”和“already approved”。

## Risks / Trade-offs

- [Risk] 规则过严会让讨论难以收敛 → Mitigation: 只检查当前 specs 已有字段和 gates，不引入额外语义判断。
- [Risk] open questions 中可能有 advisory questions → Mitigation: 当前规则按 blocking open questions 处理；如需 advisory/blocking 区分，应另起 schema change。
- [Risk] Agent 输出 ready 但 checker 降级为 not ready，用户可能疑惑 → Mitigation: CLI 显示 checker failure reasons，指引继续讨论。

## Migration Plan

- 现有 Source 数据无需迁移；checker 在下一次 discuss 或 approve 时生效。
- 已持久化的 `ready_for_approval = true` 但不满足规则的 Source，会在 approval 时被拒绝；下一次 discussion update 会被 normalize。
- 不修改 `discussion.jsonl` 历史消息。

## Verification Strategy

- OpenSpec: `openspec validate discussion-convergence-rule-checker --strict`。
- Domain tests: checker 覆盖 ready、missing confirmed points、open questions、unresolved issues、wrong status、ready flag false。
- Workflow tests: discussion update normalization、approval accept/reject。
- CLI tests: approval rejection displays checker reason; ready Source still approves successfully。
- Full gates: `pnpm typecheck`、`pnpm lint`、`pnpm format:check`、`pnpm build`、`pnpm test`。
