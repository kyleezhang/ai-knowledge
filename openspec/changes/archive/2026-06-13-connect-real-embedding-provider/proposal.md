## Why

当前项目已经具备 P3 向量索引与混合检索的��体契约：`note index --vector` 可以走 vector indexing workflow，`answer --hybrid` 也能在检索结果中组合 keyword / metadata / vector signals。但真实运行时 embedding provider 仍是 `UnsupportedEmbeddingProvider`，显式向量索引会失败，hybrid retrieval 的 vector signal 也只能降级为不可用。

本变更属于 **P3 scope**：接入真实 embedding provider 配置和 agent-layer client，让已有 `--vector` / `--hybrid` 路径从“契约和测试可用”推进到“本地配置后真实可用”。它不改变 `note.json` 作为正式知识 source of truth 的地位，也不改变默认 P0 keyword / metadata 检索行为。

## What Changes

- 扩展 agent 配置，使 embedding provider 与 chat model provider 一样通过 provider-based config 解析，API key 只来自环境变量。
- 实现真实 embedding provider client，复用 `@anthropic-ai/sdk` / Anthropic-compatible embeddings API 能力；provider 只返回 vectors 和 metadata，不写文件、不改状态、不创建索引。
- 将 `index_note_workflow` 的 `include_vector` 默认 provider 从 unsupported placeholder 切换为配置解析出的真实 embedding provider；缺少配置或凭证时显式失败且不更新 `vector_ref`。
- 将 `retrieve_hybrid_approved_notes` 在没有测试注入 provider 时可通过配置 provider 生成 query embedding；若 provider 不可用，继续保持 keyword / metadata 降级并在 debug 中说明原因。
- 保持默认 `ai-knowledge note index <note_id>` 和默认 `ai-knowledge answer "<question>"` 不强制依赖 embedding provider。
- 增加本地显式 smoke 验证路径，用于在存在 embedding API key 时验证真实 provider；默认测试仍使用 mock，不发送网络请求。
- Non-goals：不引入外部向量数据库、不重写 vector index schema、不做全量重建 / 迁移工具、不新增 Web UI、不新增 collector、不把 raw Source / draft / discussion 纳入主向量索引。

## Capabilities

### Modified Capabilities

- `llm-client-prompt-loading`: 扩展 provider-based agent config，覆盖 embedding provider 配置与凭证读取。
- `vector-indexing`: 扩展向量索引构建要求，使 workflow 可使用配置化真实 embedding provider，并定义配置缺失、provider 失败、维度不匹配时的行为。
- `hybrid-retrieval`: 扩展 hybrid retrieval 的 vector signal 行为，使 query embedding 可由配置化 provider 生成，同时保留 vector unavailable 降级语义。

## Impact

- Affected layers: agents, domain, workflows, retrieval, CLI, tests；storage schema 与文件布局原则保持不变，仅复用现有 vector index storage helper。
- Agents: 新增 embedding provider config resolver 与真实 provider client；不写文件、不改状态。
- Domain: 如需要，扩展 provider metadata / error code 类型；核心 `VectorIndex` / `IndexEntry` 契约保持兼容。
- Workflows: `note index --vector` 在未注入 fake provider 时使用配置 provider，失败时不产生 main-retrievable vector entry。
- Retrieval: `answer --hybrid` 可用配置 provider 生成 query embedding；provider 不可用时仍返回 keyword / metadata 结果。
- CLI: 用户可继续使用已有 `--vector` / `--hybrid` 入口；错误信息需要指出缺失的环境变量或 provider 配置。
- Tests: 默认 Vitest 使用 fake provider / fake SDK，不依赖真实 API key；真实 smoke 走显式脚本或命令。
