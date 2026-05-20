## Why

Issue 8 要把用户已确认的 Source 讨论结果沉淀为正式 Note 草稿，并同时生成面向阅读的 Markdown 视图。前置 Source 已进入 `approved_for_note` 后，系统需要创建 `note.json` 作为主真相、渲染 `note.md`、关联回 Source，并提供 Note 查看与重渲染能力。

## What Changes

- 实现 `ai-knowledge note compose <source_id>`。
- 前置状态必须为 `Source.status = approved_for_note`。
- 调用 Note Agent，使用 `compose-note-json.md` prompt 生成 Note 候选语义字段。
- `conclusions` 只能来自 `discussion_summary.confirmed_points`。
- workflow 补系统字段：id、slug、status、version、root/supersession 字段、timestamps、approval_context、render_metadata、quality_checks。
- 创建 Note 目录并写入 `note.json` 和 `note.md`。
- 初始 `Note.status = draft`。
- 更新 `Source.note_ids`，并执行 `approved_for_note -> noted`。
- 如果 Note 已创建但 Source 更新失败，返回 `PARTIAL_FAILURE`。
- 成功后 next action：`ai-knowledge note lint <note_id>`。
- 实现 `ai-knowledge note render <note_id>`，从 `note.json` 重渲染 `note.md`，不改变 Note 状态。
- 实现 `note list` / `note list --status <status>` / `note show <note_id>`，均支持 `--json`。
- 非目标：不实现 Note lint、Note approve、Note index、answer retrieval。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `note-lifecycle`: 细化 Note compose、Note repo/list/show、Source.note_ids 关联和 Source `approved_for_note -> noted` 语义。
- `note-rendering`: 细化 `note.md` 从 `note.json` 渲染、重渲染和模板章节契约。
- `source-lifecycle`: 细化 Source 被 Note compose 消费后的状态推进和关联 Note 行为。

## Impact

- Affected layers: domain, storage, agents, notes/rendering, workflows, CLI, tests。
- Domain: 新增或完善 Note schema、Note status、Note validators、Note candidate schema。
- Storage: 新增 Note repo/path 支持，读写 `note.json` / `note.md`，list/show 支持。
- Agents: 新增 Note Agent，使用 provider-based `LlmClient.generate_json` 和 `compose-note-json.md`。
- Notes: 新增 Markdown renderer，稳定渲染 Note JSON 为阅读视图。
- Workflows: 新增 compose/render/list/show note workflows，并更新 Source 状态与 note_ids。
- CLI: 新增 `note compose/render/list/show`。
- Tests: 覆盖 domain/storage/agent/render/workflow/CLI，真实 LLM 使用 fake client/agent。
