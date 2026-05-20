## Why

Issue 10 要把通过 QA 的 draft Note 推进到主知识层，并为后续问答建立关键词 / metadata 索引。没有 Note approval 与 index gate，系统无法区分草稿笔记和可作为回答依据的 approved knowledge。

## What Changes

- 实现 `ai-knowledge note approve <note_id>`。
- `note approve` 前置条件：`Note.status = draft`。
- `note approve` 前置条件：`quality_checks.status = passed`。
- 成功时状态流转 `draft -> approved`。
- 成功时设置 `approved_at`。
- 成功后 next action：`ai-knowledge note index <note_id>`。
- 实现 `ai-knowledge note index <note_id>`。
- `note index` 只接受 `Note.status = approved`。
- 生成 `knowledge/index/YYYY/MM/note_xxx.index.json`。
- P0 `vector_ref = null`。
- Index Entry status 只能为 `approved`。
- 支持 `--json`。
- 非目标：不实现 vector embedding、不实现 answer workflow、不索引 draft/archived/superseded Note。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `note-lifecycle`: 细化 Note approve 的 QA gate、状态流转和 `approved_at` 设置。
- `note-indexing`: 细化 approved Note 的 P0 index entry 生成、存储路径、`vector_ref = null` 和 CLI 行为。

## Impact

- Affected layers: domain, storage, indexing, workflows, CLI, tests。
- Domain: 新增或完善 IndexEntry schema/validator；复用 Note status/quality_checks invariant。
- Storage: 新增 index repo/path 支持，写入 `knowledge/index/YYYY/MM/*.index.json`。
- Indexing: 新增 build-index-entry 规则，从 approved Note 构造 summary、keywords、tags、related_note_ids、vector_ref。
- Workflows: 新增 `approve_note_workflow` 与 `index_note_workflow`。
- CLI: 新增 `note approve` 与 `note index`，支持 `--json`。
- Tests: 覆盖 approve gate、index gate、index file 写入、JSON 输出和不修改 note.md。
