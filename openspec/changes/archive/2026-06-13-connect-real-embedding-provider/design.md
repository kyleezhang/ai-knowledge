## Context

当前 `vector-indexing` 已经定义 approved `note.json` 到 vector chunks / `VectorIndex` / `IndexEntry.vector_ref` 的契约，`hybrid-retrieval` 已经定义 keyword / metadata / vector signals 的合并语义。但 agent layer 中真实 embedding provider 尚未接入：`UnsupportedEmbeddingProvider` 会在 `note index --vector` 时抛出 `Embedding provider is not configured.`，而 hybrid retrieval 只有调用方注入 `embedding_provider` 时才有 vector signal。

本设计补齐的是 provider 连接层，而不是重新设计向量索引。正式知识边界保持不变：embedding 只从 approved `note.json` 派生，vector index 只是检索缓存，answer workflow 仍回读 approved Note JSON 作答。

## Goals / Non-Goals

**Goals:**

- 为 embedding provider 增加配置解析，支持 provider name、type、base URL、API key env、model alias 和 embedding dimensions。
- 实现 agent-layer embedding provider client，能够批量把文本转成向量并返回 `embedding_model` / `embedding_dimensions` / `embeddings`。
- 让 `ai-knowledge note index <note_id> --vector` 在未显式注入 fake provider 时使用配置化真实 provider。
- 让 `ai-knowledge answer "<question>" --hybrid` 在可用配置下生成 query embedding，并把 vector signal 纳入已有 hybrid scoring。
- 保持配置缺失、API key 缺失、provider 失败、维度不匹配时的显式失败或降级语义。
- 默认自动化测试不调用真实 embedding API；真实 provider 只通过显式 smoke 验证。

**Non-Goals:**

- 不新增外部向量数据库或数据库依赖。
- 不改变 `VectorIndex`、`IndexEntry.vector_ref` 的文件布局和 source-of-truth 语义。
- 不实现全量 vector index rebuild / migration CLI。
- 不新增 reranker、query expansion、semantic clustering 或 evaluation benchmark。
- 不让默认 P0 `answer` 或默认 `note index` 强制依赖 embedding provider。
- 不支持从 raw Source、`draft_understanding`、discussion 或 `note.md` 生成主向量索引。

## Decisions

### Decision 1: embedding provider 使用独立但同风格的 provider config

在 agent config 中增加 embedding provider 配置，结构与现有 chat model provider 保持一致：provider name、provider type、`base_url`、`api_key_env`、model aliases。embedding 配置需要额外记录期望维度或通过 provider response 校验维度。

Rationale: chat model 与 embedding 都是 agent-layer provider 调用，但 embedding model、endpoint 和维度可能与 chat model 不同。独立配置可以避免把 `models.chat` 和 `models.embedding` 混在一起造成隐式耦合。

Alternatives considered:

- 复用 `model.providers.deepseek.models.chat` 作为 embedding model：拒绝，因为 chat model 与 embedding model 能力和维度不同。
- 在 CLI 参数中直接传 API key / endpoint：拒绝，因为会增加凭证泄露风险，也不符合现有 provider config 风格。

### Decision 2: 首版只支持 Anthropic-compatible embeddings client 抽象

真实 provider client 位于 `src/agents/`，通过可 mock 的低层 API 发送 embeddings 请求。实现应支持当前项目依赖的 `@anthropic-ai/sdk` 或 Anthropic-compatible endpoint；如果 SDK 的 embeddings API 类型不可直接复用，应将 HTTP/SDK 调用封装在最小 adapter 内，并在测试中 mock adapter。

Rationale: 项目已经依赖 `@anthropic-ai/sdk` 并有 DeepSeek Anthropic-compatible 配置。首版目标是让 provider 真实可连通，而不是搭一个多厂商抽象平台。

Alternatives considered:

- 引入新的 embedding SDK：暂不采用，除非现有 SDK / endpoint 无法完成 embeddings 请求；避免新增未来阶段依赖。
- 把 provider 逻辑写在 workflow 中：拒绝，会破坏 agent/workflow layering。

### Decision 3: `note index --vector` 显式失败，`answer --hybrid` 可降级

用户显式运行 `note index --vector` 时，如果配置缺失、API key 缺失或 provider 调用失败，workflow 必须返回失败，并且不得写入新的 `vector_ref`。而 `answer --hybrid` 中 vector signal 是 optional；query embedding 失败时继续使用 keyword / metadata，并在 debug 中暴露原因。

Rationale: index 构建是写操作，失败必须明显；answer 检索是读操作，已有 spec 要求 vector unavailable 时可降级，保证现有问答可用性。

Alternatives considered:

- index 失败时静默写 keyword index：仅允许默认无 `--vector` 的 P0 index 行为；用户显式要求 vector 时必须报告 vector 失败。
- answer query embedding 失败时整体失败：拒绝，因为 hybrid retrieval spec 已把 vector signal 定义为 optional。

### Decision 4: provider 返回值必须经过维度和数量校验

provider 返回的 embedding 数量必须等于输入 texts 数量；每个 vector 长度必须等于 provider metadata 声明的 `embedding_dimensions`；维度与已有 vector index 不匹配时，index workflow 拒绝写入，hybrid retrieval 跳过该 vector signal。

Rationale: 维度不一致会污染本地 vector index，并导致后续 similarity 计算不可解释。

### Decision 5: 真实 smoke 与默认测试分离

默认 `pnpm test` 使用 fake provider / fake adapter，不读取真实 API key，不发网络请求。真实 embedding smoke 通过显式脚本或既有 smoke 命令触发，只有环境变量存在时才运行，否则清晰 skip。

Rationale: 项目已有规则要求测试不依赖真实 LLM；embedding provider 也必须遵守相同原则。

## Layered Approach

```text
agents/config
  └─ resolve_embedding_provider_config()

agents/embedding-provider
  ├─ EmbeddingProvider interface       已有
  ├─ ConfiguredEmbeddingProvider       新增
  └─ embeddings API adapter            新增，可 mock

workflows/index-note-workflow
  └─ include_vector=true 时默认创建 configured provider

retrieval/retrieve-approved-notes
  └─ hybrid mode 缺少注入 provider 时尝试创建 configured query provider

cli
  └─ 复用 note index --vector / answer --hybrid，改进错误输出
```

实现顺序仍按项目 layering：agent config / provider -> workflow -> retrieval -> CLI -> tests。storage 只复用现有 helper，不新增手写路径。

## Compatibility / Migration

- 现有 `VectorIndex` JSON 和 `IndexEntry.vector_ref` schema 保持兼容。
- 已存在的 keyword-only index entries 保持 `vector_ref = null`，不需要迁移。
- 没有 embedding 配置的用户仍可运行默认 `note index` 和默认 `answer`。
- 启用 `--vector` 或 `--hybrid` vector signal 需要配置对应 API key 环境变量；缺失时不把凭证写入仓库文件。
- 如果后续更换 embedding model 或维度，旧 vector index 可通过后续单独 change 设计 rebuild；本 change 不做自动迁移。

## Risks / Trade-offs

- [Risk] DeepSeek / Anthropic-compatible embeddings endpoint 与 SDK 类型不完全一致。Mitigation: 将低层调用放入小 adapter，测试 mock adapter；实现时以实际 provider 文档和 smoke 验证为准。
- [Risk] API key 缺失导致用户以为 `--vector` 损坏。Mitigation: 错误信息明确指出缺失的 env var 和不会影响默认 keyword index。
- [Risk] embedding dimensions 配错污染 vector index。Mitigation: provider response、config expectation、vector index schema 三处校验，不一致则拒绝写入。
- [Risk] hybrid retrieval 因 provider 网络失败变慢。Mitigation: provider failure 转为 vector unavailable debug reason，不影响 keyword / metadata 结果；如需 timeout 策略另开 change。

## Verification Strategy

- OpenSpec: 校验本 change 的 `proposal.md`、`design.md`、`tasks.md` 和 capability spec deltas。
- TypeScript: 运行 `pnpm typecheck`。
- Tests: 运行 `pnpm test`，默认测试使用 fake provider / fake embeddings API adapter。
- Lint / format: 运行 `pnpm lint` 与 `pnpm format:check`。
- Build: 运行 `pnpm build`。
- Smoke: 在显式设置 embedding provider API key 时运行本地 embedding smoke；缺 key 时应清晰 skip 或非阻塞退出。
