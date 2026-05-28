## 1. Candidate domain schema

- [x] 1.1 新增 `src/domain/candidate.ts`，定义 `CandidateSourceTypeSchema`、`CandidateStatusSchema` 与基础子结构 schema。
- [x] 1.2 定义 `CandidateSchema`，覆盖最小字段、score、external_ref 与 `converted_source_id`。
- [x] 1.3 导出 `Candidate`、`CandidateStatus`、`CandidateSourceType` TypeScript types。

## 2. Candidate invariants

- [x] 2.1 实现 score breakdown 固定字段与 0-3 integer 范围校验。
- [x] 2.2 实现 `score.total` 等于 breakdown 汇总的 invariant 校验。
- [x] 2.3 实现 `status = converted` 时 `converted_source_id` 非空的 invariant 校验。
- [x] 2.4 实现非 converted 状态下 `converted_source_id = null` 的 invariant 校验。
- [x] 2.5 导出 `validate_candidate_invariants` 与 `parse_candidate`。

## 3. Tests

- [x] 3.1 新增 `tests/domain/candidate.test.ts`，覆盖合法 Candidate parse。
- [x] 3.2 覆盖 unsupported `source_type` 与 unsupported `status` 被拒绝。
- [x] 3.3 覆盖 score 子项越界与 `score.total` 不匹配被拒绝。
- [x] 3.4 覆盖 converted / non-converted `converted_source_id` invariant。
- [x] 3.5 覆盖 camelCase core field 被拒绝。

## 4. 验证

- [x] 4.1 运行 OpenSpec validation，确认 `implement-candidate-domain-schema-type` 的 proposal、design、specs、tasks 均有效。
- [x] 4.2 运行 `pnpm vitest run tests/domain/candidate.test.ts`。
- [x] 4.3 运行完整 `pnpm test`。
- [x] 4.4 运行 `pnpm typecheck`。
- [x] 4.5 运行 `pnpm lint` 与 `pnpm format:check`。
- [x] 4.6 运行 `pnpm build`。
