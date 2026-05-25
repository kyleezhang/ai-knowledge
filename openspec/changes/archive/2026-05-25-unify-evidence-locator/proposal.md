## Why

随着 P1 已引入 PDF 与显式 URL 导入，当前 `source_refs.evidence_refs` 仍主要依赖自由字符串和不一致的片段约定，难以稳定表达 Markdown、PDF、URL 三类来源中的证据位置。

本变更统一 processed artifacts 中的 evidence locator 约定，使 Note 可以继续只引用已处理产物，同时保持跨来源证据可追溯，不破坏 raw material、讨论阶段理解、approved Note 之间的边界。

## What Changes

- 统一 `processed/segments.json` 的片段定位字段，在 Markdown、PDF、显式 URL 处理结果中都提供稳定的 processed-artifact locator。
- 明确 `Note.source_refs[].evidence_refs` 只能引用 processed artifacts，优先使用 `processed/segments.json#<segment_id>` 形式。
- 为 PDF 片段提供页码或等价页内定位信息，为 URL 片段提供 heading path、section 或等价正文位置定位信息。
- 保持现有 Markdown evidence refs 的 `processed/segments.json#seg_0001` 风格有效。
- 更新 Note 生命周期规则，使 Note lint/compose 可以验证 evidence refs 至少符合统一 locator 格式并引用 processed artifacts。
- 保持 `answer` 语义不变：回答仍只基于 approved Notes，不回退读取 raw Source、draft understanding 或 discussion summary。

Non-goals:

- 不新增 PDF 或 URL 之外的输入类型。
- 不引入爬虫、搜索扩展、自动采集或 authenticated refetch。
- 不引入向量检索、数据库或 Web UI。
- 不让 `note.md` 成为可编辑主真相。
- 不允许 Note 直接引用 raw HTML、raw PDF 或 raw Markdown 文件作为正式 evidence ref。

Scope: P1。该变更建立 PDF/URL 手动导入后所需的跨来源证据定位规范，但不扩展到 P2 自动采集或 P3 向量检索。

## Capabilities

### New Capabilities
- `evidence-locator`: 定义跨 Markdown、PDF、显式 URL 的 processed evidence locator 约定，以及 `segments.json` 与 `source_refs.evidence_refs` 的一致性要求。

### Modified Capabilities
- `source-processing`: 要求 Markdown、PDF、显式 URL 的 processed segments 都暴露统一 locator 字段，并将格式特定定位信息放在 normalized artifacts 内。
- `note-lifecycle`: 要求 Note 的 `source_refs.evidence_refs` 使用统一 processed-artifact locator，并在 lint/compose 边界保持可验证。
- `answer-grounding`: 明确 answer 仍只引用 approved Notes；统一 locator 只增强 Note 内部证据追溯，不改变回答证据来源层级。

## Impact

- Affected layers:
  - domain: 增加或收紧 evidence locator / processed segment 的 schema 校验。
  - storage: 读写 `processed/segments.json` 时保留统一 locator 字段。
  - processing: Markdown、PDF、URL processor 生成一致 segment locator 与格式特定定位信息。
  - workflows: note compose / lint 使用统一 refs，避免把所有 processed artifact path 当成可选 evidence refs。
  - agents: Note Agent 的输入提示使用统一 evidence refs，不扩大 LLM 权限。
  - CLI: `note show` / `note render` 继续展示 refs，并能展示稳定 locator 字符串。
  - tests: 覆盖 Markdown/PDF/URL segments、Note source refs、lint、render/show、answer 语义不变。
- API / data impact:
  - `Note.source_refs[].evidence_refs` 仍为字符串数组，避免破坏现有 Note JSON 主结构。
  - `processed/segments.json` 增加结构化 locator 信息；现有 `id/order/heading_path/text` 语义保留。
- Dependencies:
  - 不新增运行时依赖。
