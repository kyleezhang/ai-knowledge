## 1. Domain 与状态机

- [x] 1.1 更新 `src/domain/state-machine.ts`，允许除 `processing` / `archived` 外的 Source 状态进入 `archived`，并保持 Note `draft|approved -> archived` 规则。
- [x] 1.2 补充 domain/state-machine 单元测试，覆盖 Source 成功归档状态、`processing` 拒绝、重复归档拒绝、Note draft/approved 归档与 archived/superseded 拒绝。

## 2. Storage 与索引清理

- [x] 2.1 在 `src/storage/index-repo.ts` 增加删除或移除 Index Entry 的 storage helper，路径必须通过 `storage/paths.ts` 解析。
- [x] 2.2 补充 index repo 测试，覆盖删除已存在 index、缺失 index 的可预期行为、以及不手写 `knowledge/index/` 路径。

## 3. Archive workflows

- [x] 3.1 新增 `src/workflows/archive-source-workflow.ts`，读取 Source、校验状态、通过 state machine 转 `archived`、更新 `updated_at`、保存 Source 并返回 Source summary。
- [x] 3.2 新增 `src/workflows/archive-note-workflow.ts`，读取 Note、校验状态、归档 approved Note 时移除对应 Index Entry、通过 state machine 转 `archived`、更新 `updated_at`、保存 Note 并返回 Note summary。
- [x] 3.3 定义 archive workflow 的错误映射：missing object 返回 `NOT_FOUND`，非法状态返回 `INVALID_STATE`，storage/index 清理失败返回结构化错误。
- [x] 3.4 补充 workflow 测试，覆盖 Source 归档保留 artifacts、不影响 `Source.note_ids` 指向的 Notes、Note 归档保留 `note.json` / `note.md`、approved Note 归档后 index 不再可检索、draft Note 归档不要求 index。

## 4. CLI 集成

- [x] 4.1 在 `src/cli/index.ts` 增加 `ai-knowledge source archive <source_id>`，默认输出 Source summary，支持 `--json`。
- [x] 4.2 在 `src/cli/index.ts` 增加 `ai-knowledge note archive <note_id>`，默认输出 Note summary，支持 `--json`。
- [x] 4.3 补充 CLI 测试，覆盖 text 输出、JSON 输出、missing object、invalid state，以及 archived Source / Note 仍可 list/show。

## 5. Retrieval 与生命周期验证

- [x] 5.1 确认 `retrieve_approved_notes` 对 archived Notes 不返回结果；必要时补充 focused retrieval 测试。
- [x] 5.2 确认 `note index` 对 archived Note 继续拒绝，并补充或更新测试覆盖该场景。
- [x] 5.3 补充端到端回归测试：approved Note 被归档后，`answer` 不再引用该 Note，且不会 fallback 到 raw Source。

## 6. Verification

- [x] 6.1 运行 `openspec validate source-note-archive-workflow --strict`。
- [x] 6.2 运行相关 focused Vitest 测试：domain state-machine、index repo、archive workflows、CLI、retrieval/indexing。
- [x] 6.3 运行 `pnpm typecheck`。
- [x] 6.4 运行 `pnpm lint`。
- [x] 6.5 运行 `pnpm format:check`。
- [x] 6.6 运行 `pnpm build`。
- [x] 6.7 运行 `pnpm test`。
