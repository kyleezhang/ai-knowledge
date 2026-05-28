## Context

`Candidate` 已在 PRD、schema、workflow 和 implementation 文档中定义为自动采集链路的轻量候选对象，但当前代码只实现了 Source、Note、IndexEntry 等已接入主链路的 domain object。后续 Candidate 存储、采集、推荐、选中转 Source 都依赖一个稳定的 domain contract。

本变更只补齐 domain 层的 schema/type/invariant，不引入 storage、workflow、CLI 或采集器。这样可以先固定对象边界，避免后续自动采集绕过 Candidate 直接进入 Source 或 approved knowledge。

## Goals / Non-Goals

**Goals:**

- 新增 `src/domain/candidate.ts`，集中定义 Candidate schema、type、状态枚举、来源类型与 validator。
- 使用 Zod 校验 Candidate JSON 结构，并导出 TypeScript type。
- 实现 `parse_candidate(value)`，统一执行 schema parse 与 invariant 校验。
- 覆盖 score breakdown、score range、score total、converted status 与 `converted_source_id` 的对象级 invariant。
- 通过 domain 单元测试固定合法/非法 Candidate 行为。

**Non-Goals:**

- 不实现 Candidate 文件系统存储。
- 不实现 Candidate CLI 或 workflow。
- 不实现自动采集器、去重、评分推荐、用户选择或转 Source。
- 不修改 Source/Note/IndexEntry 行为。
- 不把 Candidate 纳入 answer retrieval 或 main index。

## Decisions

### Decision 1: Candidate schema/type 放在独立 `src/domain/candidate.ts`

Candidate 与 Source/Note/IndexEntry 一样作为核心 domain object 自包含 schema、type、枚举与 invariant 校验。

Rationale: implementation spec 要求 domain 层按对象内聚组织，Candidate 虽尚未接入 workflow，但其对象契约应先独立稳定。

Alternative considered: 先把 Candidate 类型写在未来 collector 或 storage 模块中。这样会让采集实现控制对象契约，破坏 domain-first 约束。

### Decision 2: score breakdown 使用固定对象字段

`score.breakdown` 使用固定字段：`relevance`、`learning_value`、`novelty`、`discussability`。每项为 0-3 的 integer；`score.total` 必须等于四项之和。

Rationale: 这是 schema/implementation/issues 中明确的推荐评分基础契约，固定字段能避免 collector 或推荐逻辑后续写入不完整评分。

Alternative considered: 使用 `record<string, number>` 支持动态评分维度。该方案更灵活，但会弱化 P2 推荐规则的基础一致性，因此不采用。

### Decision 3: `converted_source_id` 只在 converted 状态允许非空

`status = converted` 时 `converted_source_id` MUST 非空；其他状态下 MUST 为 `null`。

Rationale: Candidate 只在成功转换为 Source 后才完成候选层职责。非 converted 状态提前携带 Source id 会制造对象关系不一致。

Alternative considered: 只要求 converted 非空，不限制其他状态。这样会允许 selected/recommended Candidate 提前引用 Source，给后续 workflow 带来歧义。

### Decision 4: 本变更不实现 Candidate 状态机 helper

只定义 `CandidateStatusSchema` 和 parse/invariant。状态流转 helper 留给后续 Candidate workflow / storage change。

Rationale: Issue 18 的范围是 schema/type/invariant。现在实现状态机 helper 会暗示 workflow 已可用，超出范围。

Alternative considered: 同时实现 `transition_candidate`。该方案会增加未使用 API，且需要提前决定后续 workflow 错误语义。

## Risks / Trade-offs

- [Risk] 后续 collector 需要更多 `source_type`。→ Mitigation: 先按 issue 明确支持 `github_trending` 与 `hacker_news`；新增来源走后续小变更扩展枚举。
- [Risk] `converted_source_id` 对非 converted 状态过严。→ Mitigation: 这是为了保持对象关系清晰；后续若确需 selected 期间记录临时 source id，应先更新 spec。
- [Risk] Candidate schema 字段较多但暂不落盘。→ Mitigation: 该 domain contract 是后续 storage/collector 的前置，测试会防止后续误写无效对象。

## Migration Plan

1. 新增 `src/domain/candidate.ts`。
2. 定义 source type、status、score、external_ref、Candidate schema/type。
3. 实现 `validate_candidate_invariants` 与 `parse_candidate`。
4. 新增 `tests/domain/candidate.test.ts`。
5. 运行 OpenSpec validation、targeted domain tests、完整测试、typecheck、lint/format、build。

Rollback strategy: 该变更只新增 domain 文件与测试，不迁移现有数据；回滚时删除新增文件和 spec 即可。

## Open Questions

- `external_ref.platform` 是否应立即枚举化为 `github | hacker_news`？当前设计倾向保持 string，以便平台标识和 `source_type` 解耦；`source_type` 负责当前支持来源的强约束。
- `published_at` / `scored_at` 是否允许 `null`？schema 文档说明 `published_at` 缺失时可为 `null`；`scored_at` 在未评分的 `new` Candidate 中也应允许为 `null`。

## Verification Strategy

- `openspec validate "implement-candidate-domain-schema-type" --strict`
- `pnpm vitest run tests/domain/candidate.test.ts`
- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm format:check`
- `pnpm build`
