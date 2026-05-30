## 1. Domain Contract

- [x] 1.1 新增 related note candidate 类型与 Zod schema，包含 `note_id`、`title`、`reason`、`status`。
- [x] 1.2 新增确认结果类型，区分 confirmed/rejected/pending candidates，保持字段 snake_case。
- [x] 1.3 增加 domain tests，覆盖候选 schema、确认状态、非法 note_id 或空 reason 拒绝。

## 2. Discovery Workflow

- [x] 2.1 实现 approved Notes 读取与候选生成 workflow，只从 `status = approved` 的 Notes 产生候选。
- [x] 2.2 实现基础 keyword/metadata/conclusion overlap 规则，并为每个候选生成可读 reason。
- [x] 2.3 确保 draft、archived、superseded、unapproved Notes 不会成为候选。
- [x] 2.4 增加 discovery workflow tests，覆盖候选生成、reason、非 approved Notes 排除、空结果。

## 3. Confirmation And Composition Integration

- [x] 3.1 实现 related note confirmation 输入解析，支持 confirmed/rejected/pending 结果。
- [x] 3.2 更新 `compose_note_workflow`，允许传入 confirmed related note ids 和 related note summaries。
- [x] 3.3 在 compose workflow 中拒绝或过滤 Note Agent 输出里未确认的 `related_note_ids`。
- [x] 3.4 增加 workflow tests，覆盖 confirmed ids 写入、未确认 ids 拒绝/过滤、无 confirmed ids 时写入 `[]`。

## 4. CLI Integration

- [x] 4.1 增加 related notes discover/confirm CLI 入口或 note compose 显式参数入口，支持 `--json`。
- [x] 4.2 CLI 输出候选 note id、title、reason 和 confirmation status。
- [x] 4.3 增加 CLI tests，覆盖 discovery、confirmation、compose 使用 confirmed related notes。

## 5. Index And Rendering Verification

- [x] 5.1 确认 note render/show 继续从 `note.related_note_ids` 展示相关笔记。
- [x] 5.2 确认 note index 只从 approved `note.json` 复制 `related_note_ids`，不做发现或推断。
- [x] 5.3 增加或补齐 tests，覆盖 Index Entry related ids 来自 approved Note JSON。

## 6. Verification

- [x] 6.1 运行 `openspec validate related-notes-discovery-confirmation --strict`。
- [x] 6.2 运行 focused Vitest tests 覆盖 related notes domain、workflow、CLI、index/render。
- [x] 6.3 运行 `pnpm typecheck`、`pnpm lint`、`pnpm format:check`、`pnpm build` 和 `pnpm test`。
