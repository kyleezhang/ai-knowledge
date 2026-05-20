## Context

当前 P0 链路已经能把 Markdown Source 处理、生成 draft_understanding、完成多轮 discussion，并通过 `source approve` 进入 `approved_for_note`。Issue 8 是从“用户已确认的讨论结论”到“正式 Note 草稿”的第一步：创建 `note.json` 主真相，渲染 `note.md` 阅读视图，并提供 Note 查看与重渲染能力。

该变更跨 domain、storage、agents、notes rendering、workflows 和 CLI。核心边界是：Note Agent 只生成语义字段候选，workflow 补系统字段并校验；`note.json` 是主真相；`note.md` 只从 `note.json` 渲染，不反向写入。

## Goals / Non-Goals

**Goals:**

- 实现 `ai-knowledge note compose <source_id>`。
- 仅允许 `Source.status = approved_for_note` compose Note。
- Note Agent 使用 `compose-note-json.md`，并生成 Note candidate 语义字段。
- workflow 补 Note 系统字段并创建 `note.json` 与 `note.md`。
- 初始 Note 状态为 `draft`，`quality_checks` 为未通过/待检查默认值。
- 更新 `Source.note_ids`，Source 状态流转 `approved_for_note -> noted`。
- Source 更新失败时返回 `PARTIAL_FAILURE`。
- 实现 `note render <note_id>` 从 `note.json` 重渲染 `note.md`，不改变 Note 状态。
- 实现 `note list` / `note list --status` / `note show`，支持 `--json`。

**Non-Goals:**

- 不实现 Note lint / QA。
- 不实现 Note approve。
- 不实现 Note index。
- 不实现 answer retrieval。
- 不创建 Note 版本分支或 superseded 流程。
- 不允许 `note.md` 反向成为主真相。

## Decisions

1. **Note Agent 只输出语义候选字段。**
   - Decision: Note Agent 输出 `title`、`conclusions`、`why_it_matters`、`current_understanding`、`open_questions`、`related_note_ids`、`source_refs`。
   - Rationale: id、slug、status、version、timestamps、approval_context、render_metadata、quality_checks 都是系统字段，应由 workflow 统一补齐。
   - Alternatives considered: 让 LLM 输出完整 `Note`。放弃原因是会让模型控制治理字段，破坏主真相可靠性。

2. **`conclusions` 必须来自 `confirmed_points`。**
   - Decision: workflow 在调用 Note Agent 前只把 `discussion_summary.confirmed_points` 作为结论来源，并在候选返回后校验 conclusions 不超出 confirmed_points。
   - Rationale: Note 代表用户确认后的知识，不能从 raw/source/draft 中新增未确认结论。
   - Alternatives considered: 允许 Agent 根据 Source 扩写 conclusions。放弃原因是会绕过讨论确认门槛。

3. **Note JSON 先落盘，再渲染 Markdown。**
   - Decision: compose workflow 先创建 `note.json`，再调用 renderer 生成 `note.md`。
   - Rationale: `note.json` 是主真相，Markdown 是派生视图。

4. **Renderer 是纯规则型。**
   - Decision: `render_note_markdown(note)` 使用固定模板渲染，不调用 LLM。
   - Rationale: Markdown 渲染不得新增未确认结论，规则型输出可测试且稳定。

5. **Note 创建成功但 Source 更新失败返回 PARTIAL_FAILURE。**
   - Decision: 如果 `note.json` / `note.md` 已创建但 Source `note_ids` 或状态保存失败，workflow 返回 `PARTIAL_FAILURE`。
   - Rationale: P0 不做复杂事务 rollback；明确暴露部分成功更安全。

## Risks / Trade-offs

- [Risk] Note Agent 输出超出 confirmed_points。→ Mitigation: workflow 校验 `conclusions` 必须来自 confirmed_points，失败则不创建 Note。
- [Risk] 多文件写入不是事务。→ Mitigation: 保证写入顺序，Source 更新失败返回 `PARTIAL_FAILURE`，不静默吞掉。
- [Risk] Markdown 渲染过于朴素。→ Mitigation: P0 优先稳定和可追溯；后续可在不改变 `note.json` 的前提下优化模板。
- [Risk] Note show 误输出完整正文。→ Mitigation: `note show` 默认只输出结构化摘要字段，不默认打印完整 `note.md`。

## Migration Plan

- 已处于 `approved_for_note` 的 Source 可运行 `note compose`。
- 不自动为历史 Source 生成 Note。
- 已生成的 draft Note 后续通过 Issue 9 lint/QA 再推进。

## Open Questions

- P0 是否需要支持同一 Source 多个 Note；建议按 specs 默认只生成一个主 Note，重复 compose 先拒绝或由后续版本策略处理。

## Verification Strategy

- 运行 OpenSpec validation。
- 运行 `pnpm typecheck`、`pnpm test`、`pnpm lint`、`pnpm format:check`、`pnpm build`。
- Domain tests 覆盖 Note schema、candidate schema、conclusions/confirmed_points 校验。
- Storage tests 覆盖 Note repo create/read/list/markdown read-write。
- Renderer tests 覆盖模板章节和稳定重渲染。
- Workflow tests 覆盖 compose 成功、前置状态失败、candidate 越界、partial failure、render 不改状态。
- CLI tests 覆盖 `note compose/render/list/show` 和 `--json`。
