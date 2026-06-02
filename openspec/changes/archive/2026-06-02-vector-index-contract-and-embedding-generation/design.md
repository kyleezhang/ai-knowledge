## Context

当前 `note-indexing` capability 已定义：只有 `approved` Note 可以进入主索引，`Index Entry` 只是检索入口，答案工作流必须回到 `note.json` 获取正式知识。P0 索引条目包含 `vector_ref = null`，说明向量能力被显式留到后续阶段。

本设计面向 P3：在不改变 P0 关键词 / 元数据检索默认行为的前提下，为 approved Note 增加向量索引派生物与 embedding 生成流程。设计必须继续保持 raw material、draft_understanding、discussion、approved Note 的边界，且不让 embedding 输出成为知识真相。

## Goals / Non-Goals

**Goals:**

- 为 approved `Note` 定义稳定的 vector index 数据契约、embedding 元数据与持久化位置。
- 在 Note 索引工作流中增加可选的 P3 向量索引构建 / 重建步骤。
- 确保 embedding 只从 approved `note.json` 的规范化文本派生，并通过 Zod 校验后落盘。
- 在 archived / superseded Note 上清理或失效向量索引，使主问答检索不返回过期知识。
- 支持 mocked embedding 的单元与工作流测试，不依赖真实 LLM / embedding API。

**Non-Goals:**

- 不改变 `note.json` 作为正式知识 source of truth 的地位。
- 不让 `note.md` 反向成为向量索引的权威输入。
- 不从 raw Source、`draft_understanding` 或 discussion 直接生成主向量索引。
- 不新增 PDF、auto-collection、Web UI、数据库替换或外部向量数据库服务。
- 不要求 P0 `ai-knowledge answer` 默认使用向量检索。

## Decisions

### Decision 1: 向量索引作为 `Index Entry` 的派生物，而不是 Note 字段

向量索引文件存放在 `knowledge/index/` 的 storage helper 管理路径下，`IndexEntry.vector_ref` 指向该派生物；`note.json` 不保存 embedding 数组。

Rationale: embedding 是可重建的检索缓存，受 provider、model、维度和 chunk 策略影响，不应污染正式知识对象。

Alternatives considered:

- 将 embedding 写入 `note.json`：拒绝，因为会把检索缓存混入知识真相，且大数组会影响人工审阅和版本化。
- 只保存在内存中：拒绝，因为 CLI-first 本地知识库需要可重建、可检查的本地持久化契约。

### Decision 2: embedding 输入来自 approved `note.json` 的规范化内容

chunking workflow 读取 approved Note 的结构化字段，按稳定顺序生成 chunk 文本，并为每个 chunk 记录 `note_id`、`chunk_id`、`source_field`、`content_hash`、`embedding_model`、`embedding_dimensions`。

Rationale: `note.md` 是阅读视图，可能格式变化；raw Source 和 discussion 未经过最终确认。只使用 approved `note.json` 可以保持可追溯性和知识边界。

Alternatives considered:

- 从 `note.md` 生成 embedding：拒绝，因为 Markdown 渲染格式变化会导致不必要的索引漂移。
- 从 Source / discussion 扩展上下文：拒绝，因为这会绕过用户确认与 Note QA gate。

### Decision 3: embedding provider 位于 agent layer，但文件写入由 workflow / storage 完成

新增 embedding provider wrapper 只负责把文本批量转换成向量并返回模型元数据。workflow 负责调用 provider、验证维度、组装 vector index、通过 storage helper 写入。

Rationale: 保持现有 layering 规则：agents 不写文件、不改状态、不创建索引；workflow 组合 domain、storage、agents。

Alternatives considered:

- provider 直接写索引文件：拒绝，因为会破坏 agent layer 边界。
- CLI 直接调用 provider 和 storage：拒绝，因为会把业务流程散落到 CLI。

### Decision 4: 向量构建失败必须显式失败，不静默降级为可检索向量条目

provider 失败、返回向量数量不匹配、维度不匹配、空 chunk、非 approved Note 都使向量索引构建失败，并且不得更新 `vector_ref` 指向新条目。

Rationale: 静默修复或部分写入会让 answer workflow 读到不完整的检索入口，影响可信度。

Alternatives considered:

- 失败时保留部分 chunk：拒绝，因为 chunk 级缺失会造成召回偏差且难以解释。
- 失败时继续写关键词索引并忽略向量：仅允许 P0 关键词索引保持原行为；若用户显式请求 vector build，则 vector 部分必须报告失败。

### Decision 5: archived / superseded 时向量索引与主索引一起失效

archive / supersede workflow 移除或标记旧 Note 的 main index entry 不可用于主检索时，也必须使对应 `vector_ref` 不再可用于主检索。

Rationale: P3 answer 可能组合关键词和向量召回；只清理关键词索引会让过期 Note 从向量路径返回。

Alternatives considered:

- 保留向量条目并由 answer 过滤状态：可作为防线，但不能作为唯一机制，因为 specs 已要求 main retrieval 不返回 archived / superseded Notes。

## Risks / Trade-offs

- [Risk] embedding provider 返回维度随模型变化而变化 → Mitigation: vector index contract 记录 `embedding_model` 与 `embedding_dimensions`，workflow 校验所有向量维度一致。
- [Risk] chunk 策略变化导致索引不可复现 → Mitigation: 记录 `chunker_version` 与 `content_hash`，重建时整体替换派生文件。
- [Risk] 向量文件过大影响本地 JSON 读写 → Mitigation: P3 首版保持文件型契约，不引入数据库；后续如需向量数据库另开变更。
- [Risk] answer workflow 误把向量 chunk 文本当知识真相 → Mitigation: specs 要求向量结果只定位 approved `note.json`，答案引用必须回读 Note。
- [Risk] archive / supersede 遗漏向量清理 → Mitigation: 将向量失效纳入 note lifecycle 和 indexing workflow 测试。

## Migration Plan

1. 增加 domain schema：`VectorIndex`, `VectorIndexChunk`, embedding metadata 与 `vector_ref` 非空校验。
2. 增加 storage helper：解析 / 写入 / 删除 `knowledge/index/**` 下的向量索引派生文件。
3. 增加 embedding provider wrapper 与 mocked provider 测试替身。
4. 扩展 note index workflow：先保持现有关键词索引行为，再在 P3 命令或选项下构建向量索引并更新 `vector_ref`。
5. 扩展 archive / supersede cleanup：通过 storage helper 让 vector index 不再参与 main retrieval。
6. 验证：运行 OpenSpec validate、typecheck、Vitest、lint / format 和 build。

Rollback: 如果向量索引构建不可用，删除或忽略 `vector_ref` 指向的派生文件即可回到 P0 关键词 / 元数据检索；不得修改 `note.json` 正式内容。

## Open Questions

- 首版 P3 是否复用 `ai-knowledge note index <note_id>` 的选项触发向量索引，还是新增单独命令，需要在实现前结合 CLI ergonomics 决定。
- 首个 embedding provider 具体使用哪个模型、维度和配置来源，需要在实现时与现有 LLM client 配置保持一致。
- chunk 字段范围是否覆盖完整 Note JSON，还是首版只覆盖标题、摘要、正文要点和关键词，需要在任务实现时用测试固定。
