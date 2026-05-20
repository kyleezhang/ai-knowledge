## Context

Issue 8 已能生成 `draft` Note 的 `note.json` 与 `note.md`，但进入 approved knowledge 前还缺少规则型 QA/lint 门槛。Issue 9 通过 `ai-knowledge note lint <note_id>` 检查 Note 主真相字段、Markdown 模板完整性和来源追溯，写回 `quality_checks`，为后续 `note approve` 提供必要前置条件。

该变更不调用 LLM、不自动修复 Note、不改变 Note 状态；它只读取 `note.json` 和 `note.md`，运行 deterministic lint，并更新 `note.quality_checks`。

## Goals / Non-Goals

**Goals:**

- 实现 `ai-knowledge note lint <note_id>`。
- P0 只允许 lint `Note.status = draft`。
- 检查 required fields / Note domain invariants。
- 检查 Markdown 模板章节完整性。
- 检查 `source_refs`、`conclusions`、`why_it_matters` 非空。
- 检查 `approval_context.source_id` 与 `approval_context.approved_from_summary_version`。
- 成功时写 `quality_checks.status = passed`。
- 失败时写 `quality_checks.status = failed`，并返回失败原因。
- 成功时 next action 为 `ai-knowledge note approve <note_id>`。
- 支持 `--json`。

**Non-Goals:**

- 不实现 Note approve。
- 不写 Index Entry。
- 不调用 LLM。
- 不自动修复 `note.json` 或 `note.md`。
- 不 lint approved/archived/superseded Note。

## Decisions

1. **lint 是规则型检查器。**
   - Decision: 新增 `note_lint(note, markdown)`，返回 passed/failed 和失败原因。
   - Rationale: P0 QA 目标是最小质量门槛，可通过 deterministic tests 验证，不需要模型判断。
   - Alternatives considered: 用 LLM 做 QA。放弃原因是会引入不稳定性，也不符合 P0 “规则型 QA / lint”。

2. **lint workflow 只允许 draft Note。**
   - Decision: `lint_note_workflow` 对非 `draft` Note 返回错误，不改写其 quality_checks。
   - Rationale: Issue 9 明确 P0 只允许 lint draft，approved Note 的后续维护另行设计。

3. **失败也写回 quality_checks。**
   - Decision: lint 失败时保存 `quality_checks.status = failed`、`empty_sections` 和 `last_checked_at`。
   - Rationale: 用户需要看到当前 QA 状态和失败原因；失败状态本身也是 Note 治理信息。

4. **Markdown 模板检查使用章节标题。**
   - Decision: P0 检查 `note.md` 是否包含 renderer 要求的章节标题。
   - Rationale: 与当前规则型 renderer 匹配，避免引入 Markdown AST 依赖。

## Risks / Trade-offs

- [Risk] 章节标题检查对模板变化敏感。→ Mitigation: 将 required sections 集中在 lint 模块，后续模板变更同步更新。
- [Risk] lint 只能检查结构，不能判断内容质量。→ Mitigation: P0 只承诺最小规则门槛；更复杂质量评估可后续另开 change。
- [Risk] 失败写回可能覆盖旧 passed。→ Mitigation: P0 仅允许 lint draft；approved 不能重新 lint。

## Migration Plan

- 已存在 `draft` Note 可运行 `note lint`。
- 不自动 lint 历史 Note。
- 不迁移 Index。

## Open Questions

- 是否需要记录详细 failure reasons 到 Note schema；当前 schema 没有 failure reasons 字段，建议 workflow result 返回 reasons，Note 只存最小 `quality_checks`。

## Verification Strategy

- 运行 OpenSpec validation。
- 运行 `pnpm typecheck`、`pnpm test`、`pnpm lint`、`pnpm format:check`、`pnpm build`。
- Unit tests 覆盖 lint pass/fail、缺章节、空字段、缺 approval context。
- Workflow tests 覆盖 draft 前置条件、quality_checks 写回、next action。
- CLI tests 覆盖人类可读输出、`--json` 和错误输出。
