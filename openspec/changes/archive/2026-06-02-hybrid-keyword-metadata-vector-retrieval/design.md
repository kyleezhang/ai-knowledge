## Context

P0 answer workflow 通过主 Index Entry 做关键词 / 元数据检索，并回读 approved `note.json` 作为答案证据。上一阶段已经建立了 `vector-indexing` 契约：approved Note 可以产生 vector index 派生物，`vector_ref` 只作为检索元数据，不能成为知识真相。

本变更面向 P3：在已有 keyword / metadata 检索和 vector index 契约之上，定义 hybrid retrieval 的候选生成、过滤、融合排序和可解释输出。它不改变 approved-only gate，不把 raw Source、`draft_understanding`、discussion 或 vector chunk text 作为答案证据。

## Goals / Non-Goals

**Goals:**

- 定义 `HybridRetrievalResult` / signal score / metadata filter 的行为契约，支持 keyword、metadata、vector signals 合并。
- 让 answer workflow 可以显式启用 hybrid retrieval，同时仍只向 answer agent 传入 approved `Note[]`。
- 支持 metadata filter / boost，例如 tags、keywords、related_note_ids、approved_at 时间范围等索引元数据。
- 支持 vector unavailable 的降级语义：缺少 `vector_ref`、vector index 文件缺失、query embedding 失败时，不影响 keyword / metadata 路径的 P0 可用性。
- 输出可解释的 retrieval debug 信息，便于测试每个命中来自哪些 signals。

**Non-Goals:**

- 不让 P0 默认 answer 强依赖 embedding provider 或 vector index。
- 不新增数据库、外部向量数据库服务或 Web UI。
- 不从 unapproved Source、draft understanding、discussion 或 `note.md` 生成主答案。
- 不把 vector chunk text、Index Entry metadata 或 score explanation 作为知识真相。
- 不改变 Note 生命周期、QA gate 或 indexing approved-only gate。

## Decisions

### Decision 1: Hybrid retrieval 先召回 signal，再合并到 Note 级候选

实现上将 keyword、metadata、vector 三类 signal 分别产出候选，候选统一按 `note_id` 去重并合并为 Note 级 `HybridRetrievalResult`。每个 result 保留 `signals[]`，记录 signal 类型、原始分、归一化分和解释信息。

Rationale: Note 是答案证据的最小正式知识单元，vector chunk 只能辅助定位 Note；Note 级合并可以避免同一 Note 的多个 chunk 重复挤占 top-k。

Alternatives considered:

- 直接按 chunk 排序传给 answer agent：拒绝，因为会把派生 chunk 暴露为答案证据并破坏 `note.json` source-of-truth。
- 只使用 vector score 替换 keyword score：拒绝，因为 P0 keyword / metadata 路径必须保持可用。

### Decision 2: Metadata 同时支持 filter 与 boost，但 filter 必须在加载 Note 前基于 Index Entry 执行

`IndexEntry` 中已有 `tags`、`keywords`、`related_note_ids`、`approved_at` 等字段，可用于轻量过滤和加权。filter 会缩小候选范围，boost 只影响排序，不得让非 approved 或 missing Note 进入结果。

Rationale: 本地 CLI-first 存储适合先用索引元数据做廉价过滤，再按需加载 Note。这样也避免为了 metadata 查询加载所有 Note JSON。

Alternatives considered:

- 每次检索都加载所有 `note.json` 再过滤：拒绝，效率低且把索引层职责弱化。
- 将 metadata filter 应用于 raw Source：拒绝，因为 answer retrieval 的主入口必须是 approved main index。

### Decision 3: Vector signal 是可选增强，失败时显式记录但不破坏非向量检索

Hybrid retrieval 可以在提供 query embedding provider 且候选有可用 `vector_ref` 时计算 vector similarity。query embedding 失败、vector index 缺失或维度不兼容时，该 signal 不参与该候选排序，并在 debug / explanation 中体现 unavailable reason。

Rationale: P3 可以增强召回，但不能让缺失 embedding 配置导致 P0 answer 不可用。

Alternatives considered:

- Vector 失败则整个 answer 失败：拒绝，因为这会破坏默认 keyword / metadata answer 能力。
- 静默忽略 vector 失败：拒绝，因为调试 retrieval 质量时需要可解释性。

### Decision 4: 融合排序采用可测试的确定性加权求和

首版使用固定权重或显式传入权重，对 normalized keyword、metadata、vector score 求和。排序 tie-breaker 固定为 `approved_at` desc，再按 `note_id` asc，确保测试可重复。

Rationale: 简单可解释、适合本地 JSON 存储和单元测试。复杂 reranker 或学习排序需要额外模型和 eval，另开变更。

Alternatives considered:

- LLM rerank：暂不采用，因为会增加不可确定性、成本和额外 agent 边界。
- 只按最大 signal 排序：拒绝，因为不能体现多信号共同支持的强匹配。

### Decision 5: Answer workflow 始终回读 approved Note JSON

Hybrid retrieval 只返回定位和排序结果。answer workflow 根据 result 的 `note_id` 加载 approved `Note`，并将 `Note[]` 传给 answer agent；agent 不接收 vector chunk text 作为证据。

Rationale: 延续 approved Note source-of-truth 规则，避免派生索引污染答案。

Alternatives considered:

- 将 chunk text 一起传给 answer agent：拒绝，因为 chunk text 是派生检索文本，不是正式知识对象。

## Risks / Trade-offs

- [Risk] score 权重主观，导致排序不符合用户预期 → Mitigation: 首版输出 signal explanation，并通过测试固定默认权重；后续优化另开变更。
- [Risk] metadata filter ��严导致无结果 → Mitigation: filter 与 boost 明确区分；CLI / workflow 输出 filter 信息和无结果原因。
- [Risk] vector index 缺失导致用户误以为 hybrid 无效 → Mitigation: explanation 记录 vector unavailable reason，同时 keyword / metadata 仍可返回。
- [Risk] answer agent 误用 retrieval explanation 当知识证据 → Mitigation: workflow 只传 approved `Note[]` 给 agent；explanation 用于 debug / JSON 输出。
- [Risk] archived / superseded Note 从 vector path 返回 → Mitigation: hybrid retrieval 必须从 main approved Index Entry 集合出发，并在加载 Note 后二次确认 status。

## Migration Plan

1. 增加 domain 类型和 Zod schema：`HybridRetrievalSignal`, `HybridRetrievalResult`, `HybridRetrievalOptions`, `MetadataFilter`。
2. 扩展 retrieval module：保留现有 `retrieve_approved_notes` 默认行为，新增显式 hybrid retrieval 入口。
3. 实现 keyword scoring、metadata filter / boost、vector similarity 和 Note 级融合排序。
4. 扩展 answer workflow：增加显式 `retrieval_mode` 或 `use_hybrid` 输入；默认仍走 P0 keyword / metadata 路径。
5. 扩展 CLI：为 `ai-knowledge answer` 增加显式 hybrid / debug JSON 选项，不改变默认输出。
6. 增加测试：domain schema、score 合并、metadata filter、vector unavailable fallback、approved-only gate、answer 回读 Note、CLI JSON。
7. 验证：OpenSpec validate、typecheck、Vitest、ESLint、Prettier check、build。

Rollback: 不启用 hybrid retrieval 时，answer workflow 继续使用现有 P0 retrieval。已生成的 vector index 派生物和 `vector_ref` 可保留，不影响默认 keyword / metadata 检索。

## Open Questions

- CLI 选项命名使用 `--retrieval hybrid` 还是 `--hybrid`，实现前应结合现有 `--top-k` / `--json` 风格决定。
- 默认权重是否设为 keyword / metadata / vector = 0.4 / 0.2 / 0.4，还是首版只允许内部常量，需要实现时用测试固定。
- Metadata filter 首版支持哪些字段：建议从 `tags`、`keywords`、`related_note_ids`、`approved_at` 开始，避免一次覆盖复杂查询语言。
