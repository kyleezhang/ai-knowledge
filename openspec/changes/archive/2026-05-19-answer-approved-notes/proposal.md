## Why

Issue 11 要让用户基于已确认知识进行后续问答，并防止系统把未确认 Source、draft_understanding 或 discussion_summary 当成正式知识。前置 Note approve/index 已具备后，本变更实现 P0 answer workflow：只检索 approved Index Entry，加载 approved Note 后生成 grounded answer。

## What Changes

- 实现 `ai-knowledge answer "<question>"`。
- 只检索 `knowledge/index/` 中 status 为 `approved` 的 Index Entry。
- P0 不 fallback 到 Source、draft_understanding 或 discussion_summary。
- 实现 keyword / metadata retrieve，支持 `--top-k`。
- 加载命中的 approved Note JSON。
- 调用 Answer Agent，使用 `answer-grounded.md` prompt。
- Answer Agent 输出结构包含：综合结论、引用 Notes、不足与边界，`unconfirmed_materials` 在 P0 为空数组。
- 没有命中时明确说明没有相关已确认知识。
- 支持 `--json`。
- 非目标：不实现向量检索、不读取 raw Source 作为 fallback、不实现跨 Source 未确认材料引用。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `answer-grounding`: 细化 P0 answer workflow、approved-only retrieval、Answer Agent 输出和无命中语义。
- `note-indexing`: 细化 answer workflow 如何使用 main index 作为 approved Note 检索入口。

## Impact

- Affected layers: domain/agents/retrieval/workflows/CLI/tests。
- Domain/Agents: 新增 GroundedAnswer schema / Answer Agent 输出 schema。
- Retrieval: 新增 keyword/metadata retrieval，从 approved Index Entry 返回 top-k。
- Workflows: 新增 `answer_question_workflow`，组合 index repo、note repo、retrieval、Answer Agent。
- CLI: 新增 `answer "<question>"`，支持 `--top-k` 与 `--json`。
- Tests: 覆盖无命中、approved-only retrieval、top-k、Answer Agent fake 输出、CLI JSON/human 输出。
