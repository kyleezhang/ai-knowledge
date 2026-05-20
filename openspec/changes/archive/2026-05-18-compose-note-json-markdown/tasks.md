## 1. Domain

- [x] 1.1 新增或完善 `NoteSchema`、`NoteStatusSchema`、`SourceRefSchema`、`ApprovalContextSchema`、`QualityChecksSchema`。
- [x] 1.2 定义 `NoteCandidateSchema`，只包含 Note Agent 语义候选字段，不包含系统字段。
- [x] 1.3 实现 Note validators，覆盖 draft/approved 基础 invariant、source_refs、approval_context、quality_checks、版本字段。
- [x] 1.4 实现 Note id/slug 生成复用现有 id/slug/time helper，支持唯一性冲突 suffix。
- [x] 1.5 添加 domain tests，覆盖 Note schema、candidate schema、conclusions 必须来自 confirmed_points、draft 默认 quality_checks。

## 2. Storage

- [x] 2.1 扩展 storage paths，支持 Note 目录、`note.json`、`note.md` 和按 id 定位 Note。
- [x] 2.2 实现 `note-repo.ts`：create/get/save/list note，read/write markdown。
- [x] 2.3 list_notes 默认按 `updated_at desc`，支持 status filter。
- [x] 2.4 添加 storage tests，覆盖 Note 创建、JSON parse、Markdown 读写、list 排序/filter、missing Note。

## 3. Note Agent

- [x] 3.1 实现 `note-agent.ts`，加载 `compose-note-json.md` prompt。
- [x] 3.2 定义 `NoteAgentInput`，包含 Source、draft_understanding、discussion_summary、source_refs、related_notes。
- [x] 3.3 调用 `LlmClient.generate_json`，使用 `NoteCandidateSchema` 校验输出。
- [x] 3.4 组织结构化 user prompt，明确 `conclusions` 只能来自 `confirmed_points`。
- [x] 3.5 添加 note-agent tests，使用 fake `LlmClient` 覆盖成功、prompt 组织和 schema failure。

## 4. Markdown Renderer

- [x] 4.1 实现 `render_note_markdown(note)`，从 `note.json` 字段生成稳定 Markdown。
- [x] 4.2 模板包含来源概览、为什么值得关注、讨论后的结论、当前理解、未解决问题、相关笔记、来源链接。
- [x] 4.3 renderer 不新增 `note.json` 中不存在的 conclusions。
- [x] 4.4 添加 renderer tests，覆盖章节完整性、稳定重渲染和不修改 Note JSON。

## 5. Workflows

- [x] 5.1 实现 `compose_note_workflow`：加载 Source，校验 `Source.status = approved_for_note`。
- [x] 5.2 workflow 调用 Note Agent 并校验 conclusions 只来自 `discussion_summary.confirmed_points`。
- [x] 5.3 workflow 补 Note 系统字段：id、slug、status=draft、version、root_note_id、timestamps、approval_context、render_metadata、quality_checks。
- [x] 5.4 workflow 创建 Note，写 `note.json` 和 `note.md`。
- [x] 5.5 workflow 更新 `Source.note_ids`，通过状态机执行 `approved_for_note -> noted` 并保存 Source。
- [x] 5.6 Source 更新失败时返回 `PARTIAL_FAILURE`。
- [x] 5.7 成功返回 next action `ai-knowledge note lint <note_id>`。
- [x] 5.8 实现 `render_note_workflow`，从 `note.json` 重渲染 `note.md`，不改变 Note 状态。
- [x] 5.9 实现 `list_notes_workflow` 和 `show_note_workflow`。
- [x] 5.10 添加 workflow tests，覆盖 compose 成功、前置状态失败、candidate 越界、partial failure、render/list/show。

## 6. CLI

- [x] 6.1 新增 `ai-knowledge note compose <source_id>`，支持 `--json`。
- [x] 6.2 新增 `ai-knowledge note render <note_id>`，支持 `--json`。
- [x] 6.3 新增 `ai-knowledge note list` 与 `note list --status <status>`，支持 `--json`。
- [x] 6.4 新增 `ai-knowledge note show <note_id>`，支持 `--json`。
- [x] 6.5 人类可读 `note show` 不默认输出完整 `note.md`。
- [x] 6.6 添加 CLI tests，覆盖 compose/render/list/show、status filter、JSON 输出和错误输出。

## 7. Verification

- [x] 7.1 运行 OpenSpec 校验，确认 `compose-note-json-markdown` change 有效。
- [x] 7.2 运行 TypeScript typecheck。
- [x] 7.3 运行 Vitest 测试套件。
- [x] 7.4 运行 ESLint 和 Prettier 检查。
- [x] 7.5 运行 build。
- [x] 7.6 使用 fake agent 跑通 `ingest -> process -> understand -> discuss -> approve -> note compose -> note render/list/show`。
