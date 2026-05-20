## Context

Issue 9 已让 draft Note 通过规则型 lint/QA 写入 `quality_checks.status = passed`。Issue 10 负责最后两个主知识层门槛：把通过 QA 的 draft Note 批准为 `approved`，并为 approved Note 生成 P0 关键词/metadata 索引。

该变更不调用 LLM，不生成 embeddings，不改变 `note.md`，也不从 draft/archived/superseded Note 建索引。它是规则型 workflow/CLI gate：Note approve 更新 `note.json` 主真相，Note index 创建 retrieval pointer。

## Goals / Non-Goals

**Goals:**

- 实现 `ai-knowledge note approve <note_id>`。
- 仅允许 `Note.status = draft` 且 `quality_checks.status = passed` 的 Note approve。
- 成功时执行 `draft -> approved`，设置 `approved_at`。
- 成功后 next action：`ai-knowledge note index <note_id>`。
- 实现 `ai-knowledge note index <note_id>`。
- 仅允许 `Note.status = approved` 建主索引。
- 生成 `knowledge/index/YYYY/MM/note_xxx.index.json`。
- Index Entry status 固定 `approved`，`vector_ref = null`。
- 支持 `--json`。

**Non-Goals:**

- 不生成向量 embedding。
- 不实现 answer workflow。
- 不索引 draft / archived / superseded Note。
- 不修改 `note.md`。
- 不重新运行 lint。

## Decisions

1. **Note approve 只依赖 quality_checks。**
   - Decision: `approve_note_workflow` 校验 `status = draft` 与 `quality_checks.status = passed` 后更新 Note。
   - Rationale: Issue 9 已负责质量检查，Issue 10 不重复 QA 逻辑。
   - Alternatives considered: approve 时重新 lint。放弃原因是职责重复，且可能导致 approve 行为不稳定。

2. **Index Entry 是 retrieval pointer。**
   - Decision: Index file 只保存 `note_id`、title、summary、keywords、tags、status、approved_at、related_note_ids、vector_ref。
   - Rationale: `note.json` 仍是知识主真相，index 只用于检索入口。

3. **P0 使用规则型 keyword/metadata index。**
   - Decision: 从 Note title、conclusions、why_it_matters、current_understanding 生成简单 keywords/tags，`vector_ref = null`。
   - Rationale: P0 明确不引入向量检索或 embedding。

4. **Indexing 不修改 Note。**
   - Decision: `index_note_workflow` 读取 approved Note，生成 index entry 并保存，不保存 Note。
   - Rationale: 重建索引不应改变知识主真相。

## Risks / Trade-offs

- [Risk] 规则型 keywords 召回有限。→ Mitigation: P0 接受 keyword/metadata 基线；P3 再引入 vector retrieval。
- [Risk] approved Note 后又被修改导致 index 过期。→ Mitigation: 后续可通过 reindex workflow 重建；本变更不修改 Note 内容。
- [Risk] 重复 index 覆盖现有 index。→ Mitigation: Index 是 retrieval pointer，可幂等覆盖同一 Note 的 index file。

## Migration Plan

- 已通过 lint 的 draft Note 可执行 `note approve`。
- 已 approved Note 可执行 `note index`。
- 不自动审批或索引历史 Note。

## Open Questions

- P0 tags 的来源是否需要独立字段；当前 Note schema 没有 tags，建议 indexer 用规则生成轻量 tags，后续可扩展 Note schema。

## Verification Strategy

- 运行 OpenSpec validation。
- 运行 `pnpm typecheck`、`pnpm test`、`pnpm lint`、`pnpm format:check`、`pnpm build`。
- Domain tests 覆盖 IndexEntry schema/validator 和 Note approved invariant。
- Storage tests 覆盖 index repo 写入/读取/list。
- Workflow tests 覆盖 approve 成功/失败、index 成功/失败、index 不改 Note。
- CLI tests 覆盖 `note approve`、`note index` 和 `--json`。
