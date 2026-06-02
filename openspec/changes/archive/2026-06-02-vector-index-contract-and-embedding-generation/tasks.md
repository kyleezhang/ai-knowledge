## 1. Domain Contracts

- [x] 1.1 新增 `VectorIndex` / `VectorIndexChunk` / embedding metadata 类型，字段保持 snake_case。
- [x] 1.2 新增 Zod schema 校验 `note_id`、`index_id`、`embedding_model`、`embedding_dimensions`、`chunker_version`、chunk traceability 和 embedding 数组。
- [x] 1.3 扩展 `IndexEntry` schema，使 P3 可校验非空 `vector_ref`，同时保留 P0 `vector_ref = null` 行为。
- [x] 1.4 增加 domain 校验函数，拒绝非 `approved` Note 的 vector indexing。
- [x] 1.5 增加 domain 测试覆盖 approved gate、draft / archived / superseded 拒绝、维度不匹配、vector count 不匹配。

## 2. Storage Helpers

- [x] 2.1 新增 vector index 路径 helper，将向量派生文件解析到 `knowledge/index/` 下，禁止 workflow / CLI 手写路径。
- [x] 2.2 新增 vector index JSON 读写与删除 / 失效 helper，并在读写时使用 Zod 校验。
- [x] 2.3 扩展现有 index cleanup helper，使 archive / supersede 可同时清理 `vector_ref` 指向的派生物。
- [x] 2.4 增加 storage 测试覆盖路径生成、写入、读取、删除、非法 JSON 拒绝。

## 3. Embedding Provider And Chunking

- [x] 3.1 实现 approved `note.json` 到稳定 chunk 列表的转换，记录 `chunk_id`、`source_field`、`content_hash` 和 `chunker_version`。
- [x] 3.2 新增 embedding provider interface 与 agent-layer wrapper，只返回 vectors 和模型元数据，不写文件、不改状态。
- [x] 3.3 提供 Vitest fake embedding provider，用于 workflow 测试且不依赖真实 LLM 调用。
- [x] 3.4 增加 chunking / provider 测试覆盖空 chunk、稳定顺序、provider 失败、返回数量不匹配。

## 4. Workflow Integration

- [x] 4.1 扩展 note indexing workflow，在显式 P3 vector indexing 路径下组合 chunking、embedding、domain 校验和 storage 写入。
- [x] 4.2 确保 vector indexing 成功后才更新 `IndexEntry.vector_ref`，失败时不写入可被主检索使用的新 vector ref。
- [x] 4.3 保持 P0 `ai-knowledge note index <note_id>` 无向量选项时继续写出 `vector_ref = null`。
- [x] 4.4 扩展 archive workflow，使 archived Note 的 main index 与 vector index 都不可用于主检索。
- [x] 4.5 扩展 supersede workflow，使旧 Note 的 main index 与 vector index 都不可用于主检索，新 draft version 不自动建索引。
- [x] 4.6 增加 workflow 测试覆盖 approved Note vector build、非 approved 拒绝、失败不更新 `vector_ref`、archive / supersede 清理。

## 5. CLI And Retrieval Boundary

- [x] 5.1 增加或扩展 CLI 入口，显式触发 P3 vector indexing / rebuild，并输出成功的 `vector_ref` 或失败原因。
- [x] 5.2 确保默认 P0 answer / indexing 行为不强制依赖 vector retrieval。
- [x] 5.3 在 answer retrieval 使用 vector hit 时回读 approved `note.json`，不从 vector chunk 文本直接生成答案。
- [x] 5.4 增加 CLI 测试覆盖 JSON 输出、失败输出、P0 默认行为兼容。

## 6. Verification

- [x] 6.1 运行 `openspec status --change "vector-index-contract-and-embedding-generation"` 确认 artifacts apply-ready。
- [x] 6.2 运行 OpenSpec validation，确保 `vector-indexing` 和 `note-indexing` delta 可归档。
- [x] 6.3 运行 TypeScript typecheck。
- [x] 6.4 运行 Vitest 测试。
- [x] 6.5 运行 ESLint / Prettier 检查。
- [x] 6.6 运行 build，确认 CLI 产物可生成。