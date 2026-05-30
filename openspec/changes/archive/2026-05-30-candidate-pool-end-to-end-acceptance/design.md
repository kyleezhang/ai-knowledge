## Context

Candidate 自动采集链路已经具备：GitHub/HN collector、Candidate storage、dedupe/filter/score、candidate select -> Source。现有 P0/P1 端到端验收覆盖 Markdown/PDF/URL 主链路，但尚未覆盖从自动采集候选池进入完整学习闭环。

本验收应使用 mocked collector / deterministic fixture 和 fake agents，保持默认测试稳定离线。真实 LLM smoke 可后续单独扩展，但不作为本变更默认 gate。

## Goals / Non-Goals

**Goals:**

- 从空 `knowledge/` 跑通 Candidate collect -> recommended Candidate。
- 验证 duplicate 不创建新的推荐项。
- 验证 dismissed Candidate 不创建 Source。
- 验证未选中 Candidate 不创建 Source。
- 验证 recommended Candidate select 后创建 Source。
- 转换后的 Source 继续跑通 process / understand / discuss / approve / note / index / answer。
- 验证 Candidate 不直接写 Index，不直接作为 answer evidence。
- 增加人工验收说明。

**Non-Goals:**

- 不访问真实 GitHub/HN。
- 不调用真实 LLM。
- 不验证定时调度。
- 不新增 collector 类型。
- 不改变业务 schema。

## Decisions

### Decision 1: 使用 workflow-level E2E 测试

测试直接调用 workflows，并注入 collector/fake agents，覆盖跨层组合行为。

Rationale: CLI 已有分层测试，workflow E2E 更适合稳定串联长链路并精确断言文件状态。

Alternative considered: 全 CLI 测试。链路更接近用户，但长流程更脆弱，已有 CLI 子命令测试可覆盖命令接入。

### Decision 2: 使用 deterministic Candidate fixture

使用 mocked collector 返回 AI 相关 Candidate，确保规则评分稳定进入 `recommended`。

Rationale: 默认测试不应依赖真实外部网站结构或网络。

Alternative considered: 真实 GitHub/HN 请求。会引入网络不稳定和外部内容波动。

### Decision 3: 验收显式检查边界

除了 happy path，还要断言：未选中 Candidate 不创建 Source，Candidate 不写 Index，answer 不直接使用 Candidate。

Rationale: Candidate 的核心产品约束是“自动采集不绕过人工选择和 Note gate”。

## Risks / Trade-offs

- [Risk] 端到端测试较长。→ Mitigation: 复用测试内 helper，不引入生产抽象。
- [Risk] fake agents 不能发现真实 prompt 问题。→ Mitigation: 真实 smoke 可后续扩展；默认验收优先稳定。
- [Risk] 规则评分变更导致 fixture 推荐状态变化。→ Mitigation: fixture 明确包含 AI 关键词、足够摘要和讨论价值信号。

## Migration Plan

1. 新增 Candidate pool E2E test fixture/helper。
2. 覆盖 collect -> recommend -> select -> Source -> Note -> Answer happy path。
3. 覆盖 duplicate/dismissed/unselected/index/answer 边界。
4. 更新 manual acceptance 文档。
5. 运行完整验证。

Rollback strategy: 该变更主要新增测试与文档；若验收不稳定，可调整 fixture 或拆分测试，不影响生产数据。

## Open Questions

- 是否要把 Candidate pool 真实 LLM smoke 合入 `pnpm test:smoke`？当前不做，避免真实 smoke 过长；可后续单独提变更。

## Verification Strategy

- `openspec validate "candidate-pool-end-to-end-acceptance" --strict`
- targeted Candidate pool E2E tests
- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm format:check`
- `pnpm build`
