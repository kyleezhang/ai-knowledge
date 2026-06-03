## Why

当前问答检索主要依赖关键词和索引元数据，P3 已具备 approved Note 的向量索引契约，但 answer workflow 还没有定义如何组合关键词、metadata 与向量召回。为了让语义相似、关键词不完全匹配、以及可由标签 / 时间 / 来源约束过滤的问题都能稳定命中，需要引入混合检索策略，同时继续保证答案只基于 approved `note.json`。

本变更属于 **P3 scope**：新增 hybrid retrieval 行为，用于组合 keyword / metadata / vector signals；不改变 P0 默认关键词检索可用性，也不引入数据库或外部向量服务作为必需依赖。

## What Changes

- 新增 hybrid retrieval 能力：定义 keyword score、metadata filters / boosts、vector similarity 如何合并为候选 Note 排序结果。
- 扩展 answer grounding：当启用混合检索时，答案仍必须回读 approved `note.json`，不得从 index metadata、vector chunk text 或 raw Source 直接作答。
- 扩展 note indexing 需求：主索引条目需要保留足够的 metadata 供 hybrid retrieval 过滤和加权，但 `Index Entry` 仍只是检索入口，不是知识真相。
- 扩展 vector indexing 使用语义：vector hits 只能参与候选召回 / 排序，不能绕过 approved-only gate，也不能让 archived / superseded Note 进入主检索。
- 增加可解释性输出：retrieval result 应暴露命中的 signal 类型和分数构成，便于调试和测试。
- Non-goals：不新增 PDF、自动采集、Web UI、数据库替换、本地向量数据库服务；不让 P0 answer 默认依赖 embedding provider；不从 unapproved material 检索主答案。

## Capabilities

### New Capabilities
- `hybrid-retrieval`: 定义 keyword、metadata 与 vector signals 的候选召回、过滤、合并排序和解释性结果契约。

### Modified Capabilities
- `answer-grounding`: 扩展问答 grounding 需求，使 hybrid retrieval 结果仍只定位 approved Notes，并要求答案基于 `note.json`。
- `note-indexing`: 扩展索引条目 metadata 使用需求，支持 hybrid retrieval 的过滤 / boost，同时保持索引不是知识真相。
- `vector-indexing`: 扩展向量命中参与 hybrid retrieval 的语义，确保 vector chunk 仅用于召回 / 排序，不作为答案知识来源。

## Impact

- Affected layers: domain, storage, retrieval, workflows, agents, CLI, tests。
- Domain: 新增 hybrid retrieval result / signal score / metadata filter 类型与 Zod schema。
- Storage: 读取已有 `IndexEntry` 与 vector index 派生物；不新增数据库，不手写 `knowledge/` 路径。
- Retrieval: 新增或扩展 retrieval module，组合 keyword、metadata、vector scores，并去重到 Note 级候选。
- Workflows: answer workflow 可显式启用 hybrid retrieval，但仍向 answer agent 传入 approved `Note[]`。
- Agents: 如需要 query embedding，仅通过 embedding provider wrapper 获取向量；agent 不读写索引、不改状态。
- CLI: 增加显式选项用于 hybrid retrieval 调试 / 启用，不改变 P0 默认 answer 行为。
- Tests: 覆盖 score 合并、metadata filter、vector unavailable fallback、approved-only gate、answer 回读 Note、CLI JSON 输出。