## Why

Issue 9 要在 Note 入库前建立规则型 QA/lint 门槛，确保未通过质量检查的 `draft` Note 不能进入 `approved`。当前 compose 已能生成 `note.json` 和 `note.md`，但还缺少对主真相字段、Markdown 模板和来源追溯的最小质量检查。

## What Changes

- 实现 `ai-knowledge note lint <note_id>`。
- P0 只允许 lint `Note.status = draft`。
- 检查 `note.json` required fields 和 domain invariants。
- 检查 `note.md` 模板章节完整性。
- 检查 `source_refs` 非空。
- 检查 `conclusions` 非空。
- 检查 `why_it_matters` 非空。
- 检查 `approval_context.source_id`。
- 检查 `approval_context.approved_from_summary_version`。
- 成功时写 `quality_checks.status = passed`，并更新模板/来源/空章节检查结果。
- 失败时写 `quality_checks.status = failed`，返回失败原因。
- 成功后 next action：`ai-knowledge note approve <note_id>`。
- 支持 `--json`。
- 非目标：不实现 Note approve、不写 index、不调用 LLM、不自动修复 Note。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `note-lifecycle`: 细化 draft Note lint/QA 规则、quality_checks 更新和 approval gate。
- `note-rendering`: 细化 Markdown 模板章节完整性检查。

## Impact

- Affected layers: qa, workflows, CLI, domain, tests。
- Domain: 复用 Note validators 与 `quality_checks` 字段，必要时补充 lint result 类型。
- QA: 新增 `note-lint` 规则检查器。
- Workflows: 新增 `lint_note_workflow`，读取 Note JSON/Markdown，运行 lint，写回 quality_checks。
- CLI: 新增 `note lint <note_id>`，支持人类可读输出与 `--json`。
- Tests: 覆盖 lint pass/fail、状态前置条件、quality_checks 写回、Markdown 模板缺章节、JSON 输出和 next action。
