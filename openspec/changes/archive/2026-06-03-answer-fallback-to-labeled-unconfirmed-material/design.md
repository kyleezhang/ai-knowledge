## Context

当前 answer workflow 只基于 approved Notes 回答；当没有命中时，它明确报告没有相关已确认知识。这符合知识边界，但对“我已经导入/处理了资料，还没来得及讨论确认，但希望临时参考”的场景支持不足。

本设计新增显式 fallback 模式：默认 answer 行为不变；只有用户通过 CLI / workflow 明确启用时，系统才读取未确认材料作为 secondary evidence。fallback 结果必须清楚标注 `unconfirmed`，并且不能创建 Note、不能写 main index、不能改变 Source / Note 状态。

## Goals / Non-Goals

**Goals:**

- 为 unconfirmed evidence 定义稳定契约，包含 `source_id`、`source_title`、`material_type`、`source_status`、`evidence_ref`、`excerpt`、`limitations`。
- 让 answer workflow 在 approved Notes 不足时可显式检索未确认材料，并把它作为 secondary evidence 传给 answer agent。
- 确保默认 P0 answer 不读取 raw Sources、draft understanding 或 discussion-stage material。
- 确保 fallback 只使用已处理/结构化材料：processed artifacts、`draft_understanding`、discussion summary；不使用 raw artifacts。
- 在 CLI 和 JSON 输出中清楚区分 `approved` 与 `unconfirmed` evidence。

**Non-Goals:**

- 不把 fallback 内容写入 `note.json`、`note.md` 或 main index。
- 不让 fallback 结果改变 Source / Note 状态。
- 不从 raw artifacts 直接回答。
- 不新增 PDF、auto-collection、Web UI、数据库替换或新的 vector retrieval 能力。
- 不允许 fallback 绕过 discussion convergence + explicit approval 生成 formal Note。

## Decisions

### Decision 1: Fallback 是显式 answer mode，不是默认行为

新增 `fallback_to_unconfirmed` 或等价 workflow/CLI 选项。默认 `ai-knowledge answer` 仍只使用 approved Notes；启用 fallback 后，workflow 先检索 approved Notes，再在不足或无命中时读取 unconfirmed materials。

Rationale: approved Notes 是主知识来源；fallback 会降低确认程度，必须由用户显式选择。

Alternatives considered:

- 默认自动 fallback：拒绝，因为会模糊“已确认知识”和“讨论中材料”的边界。
- 完全不支持 fallback：拒绝，因为用户已导入资料但尚未确认时，需要可控的临时参考能力。

### Decision 2: Fallback evidence 只来自结构化未确认材料

允许材料：processed artifacts（如 clean_text / segments / metadata）、`draft_understanding`、discussion summary。禁止材料：raw artifacts、未处理 Source、Candidate、archived Source 的 raw 文件。

Rationale: processed artifacts 和 draft/discussion summary 至少经过系统处理或学习流程沉淀，便于标注和追溯；raw artifacts 太接近原始输入，容易绕过处理 gate。

Alternatives considered:

- 允许 raw material fallback：拒绝，因为会绕过“资料进入 -> 处理 -> 初步理解 -> 讨论”的 workflow gate。
- 只允许 draft_understanding：过窄，无法回答事实定位类问题；processed segments 能提供更直接的上下文。

### Decision 3: Fallback evidence 是独立结构，不混入 approved Notes

Answer agent input 将区分 `approved_notes` 与 `unconfirmed_materials`。输出中的 `unconfirmed_materials` 必须保留材料状态和限制说明；agent prompt 必须要求未确认内容不可表述为 settled knowledge。

Rationale: 类型边界比仅在文本里加标签更可靠，测试也能验证 agent input 分离。

Alternatives considered:

- 把 fallback 文本伪装成 Note 传给 agent：拒绝，因为会破坏 Note source-of-truth。

### Decision 4: Fallback retrieval 不创建索引，不改变状态

首版 fallback 可直接从 Source repository 和 storage helpers 读取 eligible materials；它不创建 main index entry，也不改变 Source / Note 状态。

Rationale: fallback 是临时 answer evidence，不是知识沉淀；正式知识仍必须走 discussion approval -> Note -> QA -> index。

Alternatives considered:

- 为 draft materials 建临时索引：暂不采用，容易引入“草稿知识索引”和主索引边界问题。

### Decision 5: 输出中强制显式标注限制

每条 fallback evidence 必须带 `confirmation_status = unconfirmed`、`material_type`、`source_status`、`source_id`、`evidence_ref` 与 `limitations`。最终回答也必须包含未确认材料说明。

Rationale: 用户需要知道哪些结论来自 confirmed knowledge，哪些只是未确认参考。

Alternatives considered:

- 只在 answer 开头写一句“以下未确认”：拒绝，因为多条证据混合时不够可追溯。

## Risks / Trade-offs

- [Risk] 用户误把 fallback answer 当正式知识 → Mitigation: schema 和 prompt 强制 `unconfirmed` 标注，CLI/JSON 分开显示。
- [Risk] fallback 绕过讨论确认流程 → Mitigation: workflow 不创建 Note、不写 index、不改状态，并在 next action 中引导继续 discuss/approve。
- [Risk] raw artifacts 被误读为 fallback evidence → Mitigation: storage helper 只读取 processed artifacts 和结构化字段，测试覆盖 raw 禁止。
- [Risk] processed segments 过长导致 prompt 过大 → Mitigation: retrieval 层限制 excerpt 数量和长度，保留 evidence_ref。
- [Risk] fallback 与 approved Notes 混排导致答案不清晰 → Mitigation: answer output 分 primary/secondary evidence，并保留 limitations。

## Migration Plan

1. 增加 domain schema：`UnconfirmedEvidence`, `AnswerFallbackOptions`, fallback result validators。
2. 增加 fallback retrieval：遍历 eligible Sources，读取 processed artifacts / draft_understanding / discussion summary，生成带标签 evidence。
3. 扩展 answer agent schema 和 prompt，区分 `approved_notes` 与 `unconfirmed_materials`。
4. 扩展 answer workflow：默认不 fallback；显式启用后，在 approved Note 不足时附加 secondary evidence。
5. 扩展 CLI：增加 `--fallback-unconfirmed`，JSON 输出显示 fallback evidence 和 warnings。
6. 增加测试：默认禁止、显式启用、标注完整、raw 禁止、状态不变、agent input 分离。
7. 验证：OpenSpec validate、typecheck、Vitest、ESLint、Prettier check、build。

Rollback: 不传 `--fallback-unconfirmed` 时系统保持当前 answer 行为；fallback 不写持久索引，因此可以直接关闭入口回退。

## Open Questions

- fallback 首版触发条件是“无 approved Note 命中时”还是“命中但不足时也可附加”，建议实现为显式 `--fallback-unconfirmed` 且在无命中时启用，后续再扩展不足判定。
- processed artifacts 中首版使用 `segments` 还是 `clean_text`，建议优先 segments 以保留 evidence_ref。
- CLI 输出是否需要单独的“Unconfirmed materials”段落，建议非 JSON 输出也显式分段。
