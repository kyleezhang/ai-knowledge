## 1. Domain

- [x] 1.1 新增或完善 `IndexEntrySchema`，包含 `note_id`、`title`、`summary`、`keywords`、`tags`、`status`、`approved_at`、`related_note_ids`、`vector_ref`。
- [x] 1.2 实现 IndexEntry validator，确保 `status = approved`、`note_id` 非空、`approved_at` 非空、`summary` 非空、`vector_ref` 可为 null。
- [x] 1.3 确认 Note state machine 支持 `draft -> approved`。
- [x] 1.4 添加 domain tests，覆盖 IndexEntry schema、非法状态、approved Note 必须有 `approved_at` 和 `quality_checks.status = passed`。

## 2. Storage and Indexing

- [x] 2.1 扩展 storage paths，支持 `knowledge/index/YYYY/MM/note_xxx.index.json`。
- [x] 2.2 实现 `index-repo.ts`，支持 save/get/list index entries。
- [x] 2.3 实现 `build_index_entry(note)`，从 approved Note 构造 summary、keywords、tags、status、approved_at、related_note_ids、`vector_ref = null`。
- [x] 2.4 添加 storage/indexing tests，覆盖路径、保存、读取、list、validator、`vector_ref = null`。

## 3. Workflows

- [x] 3.1 实现 `approve_note_workflow`，校验 `Note.status = draft`。
- [x] 3.2 `approve_note_workflow` 校验 `quality_checks.status = passed`。
- [x] 3.3 成功时通过状态机执行 `draft -> approved`，设置 `approved_at`，保存 Note。
- [x] 3.4 `approve_note_workflow` 成功返回 next action `ai-knowledge note index <note_id>`。
- [x] 3.5 实现 `index_note_workflow`，校验 `Note.status = approved`。
- [x] 3.6 `index_note_workflow` 构造并保存 Index Entry，不修改 `note.json` 或 `note.md`。
- [x] 3.7 添加 workflow tests，覆盖 approve 成功/失败、index 成功/失败、index 不改 Note。

## 4. CLI

- [x] 4.1 新增 `ai-knowledge note approve <note_id>`，支持 `--json`。
- [x] 4.2 新增 `ai-knowledge note index <note_id>`，支持 `--json`。
- [x] 4.3 人类可读输出展示 Note id、status、next action 或 index entry summary。
- [x] 4.4 添加 CLI tests，覆盖 approve/index 成功、`--json`、draft index 拒绝、未通过 QA approve 拒绝。

## 5. Verification

- [x] 5.1 运行 OpenSpec 校验，确认 `approve-note-and-index` change 有效。
- [x] 5.2 运行 TypeScript typecheck。
- [x] 5.3 运行 Vitest 测试套件。
- [x] 5.4 运行 ESLint 和 Prettier 检查。
- [x] 5.5 运行 build。
- [x] 5.6 使用 fixture 跑通 `note lint -> note approve -> note index`，确认 index file 生成且 Note 为 approved。
