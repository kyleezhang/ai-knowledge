## 1. QA Lint Core

- [x] 1.1 新增 `src/qa/note-lint.ts`，定义 lint result 类型，包含 `passed`、`failures`、`quality_checks`。
- [x] 1.2 实现 required fields 检查，覆盖 `source_refs`、`conclusions`、`why_it_matters`、`approval_context.source_id`、`approval_context.approved_from_summary_version`。
- [x] 1.3 实现 Markdown required sections 检查，复用 renderer 模板章节。
- [x] 1.4 lint 成功时生成 `quality_checks.status = passed`、`template_complete = true`、`source_links_present = true`、`empty_sections = []`。
- [x] 1.5 lint 失败时生成 `quality_checks.status = failed`，记录缺失章节到 `empty_sections`，返回 failure reasons。
- [x] 1.6 添加 QA unit tests，覆盖 pass、缺 source_refs、空 conclusions、空 why_it_matters、缺 approval_context、缺 Markdown 章节。

## 2. Workflow

- [x] 2.1 实现 `lint_note_workflow`，加载 Note 和 `note.md`。
- [x] 2.2 前置状态只允许 `Note.status = draft`。
- [x] 2.3 调用 `note_lint` 并写回 `note.quality_checks`。
- [x] 2.4 lint 通过时返回 next action `ai-knowledge note approve <note_id>`。
- [x] 2.5 lint 失败时返回 `QA_FAILED`，包含 failure reasons，并保持 Note.status 为 `draft`。
- [x] 2.6 非 draft Note lint 请求应拒绝且不更新 quality_checks。
- [x] 2.7 添加 workflow tests，覆盖 pass、fail、非 draft 拒绝、quality_checks 写回和 next action。

## 3. CLI

- [x] 3.1 新增 `ai-knowledge note lint <note_id>` 命令。
- [x] 3.2 人类可读输出展示 pass/fail、failure reasons 和 next action。
- [x] 3.3 支持 `--json` 输出 workflow result。
- [x] 3.4 添加 CLI tests，覆盖成功输出、失败输出、`--json` 和非 draft 错误。

## 4. Verification

- [x] 4.1 运行 OpenSpec 校验，确认 `lint-note-quality` change 有效。
- [x] 4.2 运行 TypeScript typecheck。
- [x] 4.3 运行 Vitest 测试套件。
- [x] 4.4 运行 ESLint 和 Prettier 检查。
- [x] 4.5 运行 build。
- [x] 4.6 使用 fixture 跑通 `note compose -> note lint`，确认通过后 next action 指向 `note approve`。
