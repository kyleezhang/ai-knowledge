## Context

P0 主链路已经支持从 Markdown Source 到 approved Note，并生成 main Index Entry。Issue 11 要让用户基于已确认知识进行后续问答：answer workflow 必须只从 approved index entries 召回 Note，加载 `note.json` 作为知识主真相，再调用 Answer Agent 生成 grounded answer。

该变更的关键边界是：P0 不 fallback 到 Source、draft_understanding 或 discussion_summary；没有命中 approved Note 时要明确说明暂无相关已确认知识；Answer Agent 不得把模型常识包装成知识库结论。

## Goals / Non-Goals

**Goals:**

- 实现 `ai-knowledge answer "<question>"`。
- 只检索 `IndexEntry.status = approved` 的主索引。
- 通过 keyword / metadata retrieval 返回 top-k index entries。
- 加载命中的 approved `note.json`。
- 调用 Answer Agent，使用 `answer-grounded.md`。
- 输出结构包含 conclusion、cited_notes、unconfirmed_materials、limitations。
- 没有命中时明确说明没有相关已确认知识。
- 支持 `--top-k` 与 `--json`。

**Non-Goals:**

- 不 fallback 到 Source、draft_understanding、discussion_summary 或 raw artifacts。
- 不实现 vector retrieval。
- 不实现 answer caching。
- 不把模型常识作为知识库结论。
- 不修改 Note 或 Index Entry。

## Decisions

1. **P0 retrieval 只读 approved Index Entry。**
   - Decision: `retrieve_notes` 只读取 index repo 中 status 为 `approved` 的 entries，按 question 与 title/summary/keywords/tags 的简单匹配排序。
   - Rationale: index entry 是 approved Note 的检索入口，P0 不应读取 Source 作为主证据。
   - Alternatives considered: 没有命中时 fallback 到 Source。放弃原因是 Issue 11 明确 P0 不 fallback 到 Source。

2. **Answer Agent 只接收 approved Notes。**
   - Decision: workflow 加载 Note 并再次校验 `Note.status = approved`，再传给 Answer Agent。
   - Rationale: 防止 index 文件损坏或过期时将非 approved Note 传入回答。

3. **无命中不调用 LLM。**
   - Decision: top-k retrieval 为空时 workflow 直接返回“没有相关已确认知识”的结构化 answer。
   - Rationale: 没有 approved evidence 时调用 LLM 容易引入常识补全；P0 应明确不足。

4. **P0 `unconfirmed_materials` 固定为空。**
   - Decision: Answer Agent schema 允许 `unconfirmed_materials`，但 P0 workflow/agent 输入不提供未确认材料，期望输出为空数组。
   - Rationale: 保留输出结构完整，同时明确 P0 不使用 secondary evidence。

## Risks / Trade-offs

- [Risk] keyword retrieval 召回有限。→ Mitigation: P0 接受关键词/metadata 基线；P3 再引入 vector retrieval。
- [Risk] LLM 使用模型常识补充。→ Mitigation: prompt 明确只能基于 approved Notes；tests 使用 fake agent 验证 workflow 输入只包含 approved notes。
- [Risk] index entry 指向缺失或非 approved Note。→ Mitigation: workflow 加载 Note 后再次检查 `Note.status = approved`，跳过无效条目。

## Migration Plan

- 已 indexed 的 approved Notes 可被 answer workflow 检索。
- 未 indexed 的 approved Notes 暂不参与 P0 answer，需先运行 `note index`。
- 不迁移 Source 或 discussion 数据。

## Open Questions

- 中文分词是否需要增强；建议 P0 先用简单字符串包含和 token split，后续可引入更好的检索策略。

## Verification Strategy

- 运行 OpenSpec validation。
- 运行 `pnpm typecheck`、`pnpm test`、`pnpm lint`、`pnpm format:check`、`pnpm build`。
- Retrieval tests 覆盖 approved-only、top-k、no hit。
- Agent tests 覆盖 `answer-grounded.md` prompt 和 schema。
- Workflow tests 覆盖 no hit、hit approved note、skip invalid note、JSON output data。
- CLI tests 覆盖 human-readable、`--json`、`--top-k`。
