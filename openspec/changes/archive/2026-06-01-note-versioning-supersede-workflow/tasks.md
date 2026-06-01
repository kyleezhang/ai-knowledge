## 1. Domain 与 Note summary

- [x] 1.1 更新 `src/domain/note.ts` invariant，校验版本链字段：v1 root、自身引用、`superseded` 必须有 `superseded_by_note_id`、新版 `supersedes_note_id` 与 root/version 一致。
- [x] 1.2 更新 `src/domain/state-machine.ts` 和 domain tests，确认 `approved -> superseded` 合法，`draft|archived|superseded -> superseded` 非法。
- [x] 1.3 更新 `NoteSummary` / `show_note_workflow` / CLI summary 输出，包含 `version`、`root_note_id`、`supersedes_note_id`、`superseded_by_note_id`。
- [x] 1.4 更新 note rendering（如需要）以展示版本链字段，并补充 render/show tests。

## 2. Workflow 实现

- [x] 2.1 新增 `supersede-note-workflow`，输入 `old_note_id`、`source_id`、可选 confirmed related note ids，读取 old Note 和 approved_for_note Source。
- [x] 2.2 复用 note composition 约束生成新版 draft Note：结论来自 confirmed points，evidence refs 来自 processed segments，related ids 必须显式确认。
- [x] 2.3 创建新版 Note 时设置 `version = old.version + 1`、继承 `root_note_id`、设置 `supersedes_note_id = old.id`、`superseded_by_note_id = null`。
- [x] 2.4 新版创建成功后，通过 state machine 将旧版 approved Note 转为 `superseded`，写入 `superseded_by_note_id = new.id`。
- [x] 2.5 supersede 旧版时移除旧版 Index Entry；新版 draft 不自动创建 Index Entry。
- [x] 2.6 定义错误映射：missing object 返回 `NOT_FOUND`，非法状态返回 `INVALID_STATE`，新版创建成功但旧版更新或 index cleanup 失败返回 `PARTIAL_FAILURE`。
- [x] 2.7 补充 workflow tests，覆盖 happy path、旧版非 approved、Source 非 approved_for_note、未确认 related ids、旧版更新失败 partial failure、旧版 index 被移除且新版未 index。

## 3. CLI 集成

- [x] 3.1 增加 `ai-knowledge note supersede <old_note_id> <source_id>` 命令，默认输出 old/new Note summaries 和 next action。
- [x] 3.2 支持 `--related-note <note_id...>` 和 `--json`，语义与 `note compose --related-note` 对齐。
- [x] 3.3 补充 CLI tests，覆盖 text 输出、JSON 输出、invalid state、missing object、版本链字段在 `note show` 中可见。

## 4. Retrieval / indexing 验证

- [x] 4.1 确认 `note index` 对 superseded Note 继续拒绝，并补充测试。
- [x] 4.2 补充 retrieval / answer tests，确认 superseded old Note 不进入 answer，且新版 draft 未 approve/index 前不会作为主知识返回。
- [x] 4.3 覆盖 index cleanup 使用 storage helper，不手写 `knowledge/index/` 路径。

## 5. Issues 与文档同步

- [x] 5.1 实现完成后更新 `specs/issues.md`，将 Issue 29 标记为 Done 并保留 Issue 30 中剩余 re-index / lifecycle cleanup 差距。
- [x] 5.2 如实现中调整 CLI 命令名或参数，更新本 change 的 proposal/design/specs/tasks 以保持一致。

## 6. Verification

- [x] 6.1 运行 `openspec validate note-versioning-supersede-workflow --strict`。
- [x] 6.2 运行相关 focused Vitest 测试：domain note/state-machine、supersede workflow、CLI、indexing/retrieval、render/show。
- [x] 6.3 运行 `pnpm typecheck`。
- [x] 6.4 运行 `pnpm lint`。
- [x] 6.5 运行 `pnpm format:check`。
- [x] 6.6 运行 `pnpm build`。
- [x] 6.7 运行 `pnpm test`。
