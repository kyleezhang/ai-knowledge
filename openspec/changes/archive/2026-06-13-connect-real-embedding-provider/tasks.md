## 1. Agent Config And Provider Contract

- [x] 1.1 扩展 agent config 类型，增加 embedding provider 配置、默认 provider、model alias、`api_key_env`、`base_url` 和期望维度字段，字段保持 snake_case。
- [x] 1.2 新增 `resolve_embedding_provider_config()` 或等价 resolver，缺 provider、缺 model alias、缺 API key 时抛出稳定 `AgentError`，错误信息包含 provider 或 env var 名称。
- [x] 1.3 扩展 `EmbeddingProvider` 相关类型，使 provider metadata 与 `EmbeddingMetadata` 契约一致，并明确 provider 不写文件、不改状态、不创建索引。
- [x] 1.4 增加 agent config 单元测试，覆盖默认 embedding provider、provider override、未知 provider、缺 API key、维度配置。

## 2. Real Embedding Provider Client

- [x] 2.1 实现配置化 embedding provider client，通过可 mock 的 Anthropic-compatible embeddings adapter 发送批量文本请求。
- [x] 2.2 校验 provider 返回数量等于输入 `texts.length`，每个 embedding 都是有限 number 数组，且维度与 metadata / config 一致。
- [x] 2.3 将 provider 调用失败、响应结构非法、维度不一致映射为 `AgentError` 或 workflow 可识别错误，不泄露 API key。
- [x] 2.4 增加 provider 单元测试，使用 fake adapter 覆盖成功、provider failure、空输入、数量不匹配、非数值向量、维度不匹配。

## 3. Vector Index Workflow Integration

- [x] 3.1 修改 `index_note_workflow`：当 `include_vector=true` 且调用方未注入 `embedding_provider` 时，创建配置化真实 embedding provider。
- [x] 3.2 保持 `include_vector=false` 时的 P0 keyword index 行为不读取 embedding config、不要求 API key，`vector_ref` 仍为 `null`。
- [x] 3.3 确保 `include_vector=true` 的 provider/config/validation 失败不会更新新的 `IndexEntry.vector_ref`，也不会留下 main-retrievable invalid vector index。
- [x] 3.4 增加 workflow 测试，覆盖默认 provider 创建、缺 API key 失败、fake provider 成功写入 vector_ref、provider 失败不更新 vector_ref。

## 4. Hybrid Retrieval Integration

- [x] 4.1 修改 `retrieve_hybrid_approved_notes`：当未注入 `embedding_provider` 但配置可用时，使用配置化 provider 生成 query embedding。
- [x] 4.2 保持 provider 缺失、API key 缺失、query embedding 失败时 vector signal optional，keyword / metadata 结果继续返回，并在 debug 中记录原因。
- [x] 4.3 确保 query embedding dimensions 与 candidate vector index dimensions 不一致时只跳过该 vector signal，不让整个 answer workflow 失败。
- [x] 4.4 增加 retrieval / workflow 测试，覆盖真实 provider resolver 被调用、配置缺失降级、维度不匹配降级、vector signal 成功参与 score。

## 5. CLI And Smoke Path

- [x] 5.1 保持既有 CLI 入口 `ai-knowledge note index <note_id> --vector` 和 `ai-knowledge answer "<question>" --hybrid`，不新增重复命令。
- [x] 5.2 改进 CLI 错误与 JSON 输出：`note index --vector` 失败时说明 provider/config/env var 问题；`answer --hybrid --json` 暴露 vector unavailable debug reason。
- [x] 5.3 增加或扩展显式本地 smoke 脚本，用于在 embedding API key 存在时验证真实 embedding provider；缺 key 时 skip 或非阻塞退出。
- [x] 5.4 增加 CLI 测试，覆盖默认 index / answer 不需要 embedding key、`--vector` 缺 key 失败、`--hybrid` 缺 key 降级。

## 6. Spec And Documentation Sync

- [x] 6.1 更新 `openspec/specs/llm-client-prompt-loading` delta，记录 embedding provider config 与凭证读取规则。
- [x] 6.2 更新 `openspec/specs/vector-indexing` delta，记录真实 provider 接入后的成功、配置缺失、provider 失败、维度校验语义。
- [x] 6.3 更新 `openspec/specs/hybrid-retrieval` delta，记录 query embedding provider 可配置与 vector unavailable fallback 语义。
- [x] 6.4 如实现中确认具体 env var、默认 provider 名称、默认 embedding model 或 smoke 命令，同步更新 `specs/issues.md` 当前实现快照或 backlog 条目。

## 7. Verification

- [ ] 7.1 运行 OpenSpec validation，确认本 change 的 spec deltas 可应用并且 apply-ready。（当前环境没有 `openspec` CLI，未运行）
- [x] 7.2 运行 `pnpm typecheck`。
- [x] 7.3 运行 `pnpm test`。
- [x] 7.4 运行 `pnpm lint`。
- [x] 7.5 运行 `pnpm format:check`。
- [x] 7.6 运行 `pnpm build`。
- [x] 7.7 在有真实 embedding provider 凭证时运行显式 smoke；没有凭证时记录 skip 行为。
