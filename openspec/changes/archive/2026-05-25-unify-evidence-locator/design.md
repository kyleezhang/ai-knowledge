## Context

当前系统已经通过 `processed/clean_text.md`、`processed/segments.json`、`processed/metadata.json` 将 raw material 与下游理解流程隔离，并在 `Note.source_refs[].evidence_refs` 中保留证据引用字符串。问题是这些字符串和 `segments.json` 的片段结构还没有统一的 locator 语义：Markdown 测试中使用 `processed/segments.json#seg_0001`，schema 示例中出现 `processed/segments.json#12`，compose workflow 还会把所有 processed artifact path 暴露给 Note Agent。

P1 中 PDF 与显式 URL 已进入手动导入范围，证据定位需要从“能引用某个产物”提升为“能定位到跨来源的 processed segment”。设计必须保留 `note.json` 作为正式知识主真相，且不能让 Note 或 answer 流程回退直接依赖 raw PDF、raw HTML 或 draft/discussion 内容。

## Goals / Non-Goals

**Goals:**

- 为 Markdown、PDF、显式 URL 统一 `processed/segments.json` 的 locator 字段。
- 让 `Note.source_refs[].evidence_refs` 继续保持字符串数组，但统一为 processed-artifact locator。
- 使 PDF locator 能表达页码或等价页内位置，使 URL locator 能表达 heading path、section 或等价正文位置。
- 让 note compose / lint 能验证 evidence refs 至少符合统一格式，并避免把非片段 artifact 当作正式证据 ref。
- 保持 answer 工作流只使用 approved Notes 作答，不改变 evidence 来源层级。

**Non-Goals:**

- 不把 `source_refs.evidence_refs` 改成对象数组，避免扩大 Note JSON 主结构迁移面。
- 不支持 raw 文件 locator，例如 `raw/original.pdf#page=1` 或 `raw/original.html#id`。
- 不新增爬虫、自动采集、向量检索、数据库或 Web UI。
- 不要求 URL processor 保留精确 DOM path；URL 可使用 heading path、section id 或正文序号作为稳定 processed 位置。
- 不让 LLM 自行发明 evidence refs；workflow 必须提供可用 locator 集合并校验输出。

## Decisions

### Decision 1: Evidence ref 字符串统一为 `processed/segments.json#<segment_id>`

`Note.source_refs[].evidence_refs` 保持字符串数组，正式 evidence ref MUST 引用 processed artifacts，且标准形式为 `processed/segments.json#seg_0001` 这类 segment anchor。

Rationale: 这与现有测试中的 Markdown 约定兼容，保持 Note JSON 轻量，并避免把 raw path、PDF 页锚点或 URL fragment 直接暴露为正式知识引用。

Alternative considered: 将 `evidence_refs` 改为对象数组，直接包含 `source_kind/page/heading_path/url_fragment`。这会让 Note schema 迁移面更大，也会让正式知识对象承载过多 processor 细节，因此不采用。

### Decision 2: 在 processed segment 中增加结构化 `locator`

每个 segment 保留现有 `id`、`order`、`heading_path`、`text`，并增加 `locator` 对象。建议字段：

- `ref`: 与 Note evidence ref 完全一致的字符串，例如 `processed/segments.json#seg_0001`。
- `source_kind`: `markdown`、`pdf` 或 `url`。
- `position`: 数字化正文顺序，默认与 segment `order` 一致。
- `page`: PDF 可用；Markdown/URL 为 `null` 或省略。
- `heading_path`: 与 segment 顶层字段保持一致，用于 Markdown/URL/PDF 的章节定位。
- `section`: URL 或 Markdown 可用的 section/heading 标识，无法稳定提取时可省略。

Rationale: Note 只保存字符串 ref，而 `segments.json` 保存用于解释 ref 的结构化定位信息。这样下游展示、QA、未来检索可以从 processed artifact 解析 locator，而不破坏 Note 的主结构。

Alternative considered: 只依赖 `id` 和 `heading_path`。这无法规范 PDF page 与 URL section 的最低要求，也不能让 lint 明确检查 ref 是否来自 segment。

### Decision 3: Workflow 生成 allowed evidence refs，而不是暴露所有 artifact path

note compose 应从 `processed/segments.json` 读取 segments，并把每个 segment 的 `locator.ref` 或 `processed/segments.json#<id>` 作为允许的 evidence refs 提供给 Note Agent。`processed/clean_text.md` 与 `processed/metadata.json` 不应作为正式 evidence refs 提供给模型。

Rationale: 目前把 `Object.values(source.processing_artifacts)` 作为 evidence refs 会让模型选择整个 artifact，而不是具体证据片段。统一 locator 后，模型只能在 processed segment anchors 中选择，workflow 仍可验证输出是否属于 allowed refs。

Alternative considered: 继续允许 artifact-level refs。这样实现更少，但无法满足 PDF/URL 的可定位证据要求，因此不采用。

### Decision 4: Lint 做格式校验与可解析校验，compose 做候选输出约束

lint 至少检查：

- `source_refs` 非空。
- 每个 `evidence_refs` 非空。
- 每个 evidence ref 都匹配 `processed/segments.json#<segment_id>`。
- 对当前 Source 可解析时，ref 必须存在于对应 `segments.json`。

compose workflow 在 Note Agent 输出后做同样的子集校验；校验失败时拒绝 candidate，不静默修复。

Rationale: LLM 输出必须通过 schema 和 workflow 校验；不能让模型自行创造 locator 并继续流程。lint 作为 approval gate 的一部分，也需要阻止无效 locator 进入 approved Note。

Alternative considered: 仅在 render/show 时展示，不阻止无效 ref。这样会推迟错误暴露，并可能让不可追溯 Note 获批，因此不采用。

### Decision 5: Answer grounding 不解析 raw source，仅继承 Note traceability

answer 工作流继续通过 main index 取得 approved Notes，并在回答中引用 note-level evidence。统一 locator 只让这些 approved Notes 内部拥有更稳定的 `source_refs.evidence_refs`，不改变 answer 是否访问 Source 或 raw artifacts 的规则。

Rationale: 保持 P0/P1 的知识边界：approved Note 是回答主证据，raw Source 与 draft/discussion 不能被 answer 当作正式知识。

Alternative considered: answer 阶段按 evidence refs 读取 processed segments 增强回答。该方案可能提升细节，但会改变 answer 证据加载路径，超出本变更范围。

## Risks / Trade-offs

- [Risk] 旧 Note 或测试中的 `processed/segments.json#12` 与新 `#seg_0001` 风格不一致。→ Mitigation: 新生成内容统一使用 `seg_` id；若需要兼容旧数据，可在 lint 中明确报告旧格式并要求重新 compose 或人工修正，不自动改写 approved Note。
- [Risk] URL 页面缺少稳定 HTML id，无法提供真实网页 fragment。→ Mitigation: locator 只要求 processed body position/heading/section，不承诺可跳回原网页精确 DOM。
- [Risk] PDF 页内精确坐标需要额外解析能力。→ Mitigation: P1 最低要求是页码或等价页内位置，不引入坐标级定位。
- [Risk] 增加 segment schema 字段可能影响旧测试 fixture。→ Mitigation: 保留现有字段语义，并集中更新 processor fixtures 和 artifact schema。
- [Risk] LLM 仍可能输出未提供的 evidence ref。→ Mitigation: workflow 做 allowed-ref 子集校验，失败即拒绝 candidate，不静默修复。

## Migration Plan

1. 更新 domain/storage 中 processed segment schema，新增 `locator`，保留 `id/order/heading_path/text`。
2. 更新 Markdown/PDF/URL processor，使每个 segment 都生成 `locator.ref = processed/segments.json#<id>` 与对应 source-kind 定位字段。
3. 更新 note compose allowed refs 构造逻辑，从 `segments.json` 生成 segment refs，不再直接使用所有 processing artifact paths。
4. 更新 Note candidate 校验与 lint，拒绝 raw path、artifact-level path、缺失 segment anchor、以及可解析但不存在的 segment id。
5. 更新 render/show 仅展示字符串 ref，不改变命令契约。
6. 更新测试：processor、note compose/lint、render/show、answer grounding 语义不变。

Rollback strategy: 若实现中发现 locator schema 影响过大，可先保留 `locator` 为 optional，但 processor 新产物必须写入；Note compose/lint 仍以 `processed/segments.json#<id>` 为唯一正式 ref 格式。

## Open Questions

- 是否需要在 `segments.json` 顶层增加版本字段，例如 `{ "version": 1, "segments": [...] }`？当前设计倾向保持现有数组结构，减少迁移成本。
- 是否允许 lint 对历史 `processed/segments.json#12` 做兼容？当前设计倾向不在新规则中继续生成旧格式，只在错误信息中提示修复。

## Verification Strategy

- 运行 OpenSpec 校验，确保新增与修改 requirements 可解析。
- 运行 TypeScript typecheck、Vitest、lint、format/build 中该仓库已有的质量命令。
- 添加或更新单元测试覆盖 Markdown/PDF/URL segment locator、Note compose allowed refs、Note lint 无效 locator、Note render/show refs 展示、answer approved-note-only 语义不变。
