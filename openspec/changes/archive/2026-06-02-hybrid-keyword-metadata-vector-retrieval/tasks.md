## 1. Domain Contracts

- [x] 1.1 新增 `HybridRetrievalSignal`、`HybridRetrievalResult`、`HybridRetrievalOptions`、`MetadataFilter` 类型，字段保持 snake_case。
- [x] 1.2 新增 Zod schema 校验 signal 类型、score、final_score、note_id、metadata filters、debug explanation。
- [x] 1.3 增加 domain 校验函数，确保 hybrid result 只引用 approved main index 候选，并拒绝空 `note_id` / 非法 score。
- [x] 1.4 增加 domain 测试覆盖 schema、score 边界、metadata filter 输入、signal explanation。

## 2. Retrieval Core

- [x] 2.1 保留现有 `retrieve_approved_notes` 默认 keyword / metadata 行为，新增显式 hybrid retrieval 入口。
- [x] 2.2 实现 keyword scoring，并将 title、summary、keywords、tags 的命中解释记录为 keyword signal。
- [x] 2.3 实现 metadata filter / boost，首版支持 `tags`、`keywords`、`related_note_ids`、`approved_at` 范围。
- [x] 2.4 实现 vector signal：读取 `vector_ref` 指向的 vector index，计算 query embedding 与 chunk embedding similarity。
- [x] 2.5 实现 Note 级去重合并、score 归一化、加权求和和 deterministic tie-break。
- [x] 2.6 实现 vector unavailable debug reason，不让 query embedding / vector index 失败破坏 keyword / metadata 结果。
- [x] 2.7 增加 retrieval 测试覆盖多 signal 合并、metadata filter、vector 维度不匹配、缺失 vector_ref、approved-only gate、top-k。

## 3. Workflow Integration

- [x] 3.1 扩展 answer workflow 输入，增加显式 hybrid retrieval 开关 / mode，默认仍走 P0 retrieval。
- [x] 3.2 在 hybrid mode 下调用 hybrid retrieval，并只把加载出的 approved `Note[]` 传给 Answer Agent。
- [x] 3.3 将 retrieval debug / signal explanation 放入 workflow JSON data，但不传给 Answer Agent 作为证据。
- [x] 3.4 增加 workflow 测试覆盖 hybrid mode、默认 P0 兼容、无命中、vector unavailable fallback。

## 4. CLI Integration

- [x] 4.1 扩展 `ai-knowledge answer`，增加显式 hybrid retrieval 选项，并保持默认命令行为不变。
- [x] 4.2 扩展 `--json` 输出，使 hybrid mode 可返回 matched_note_ids 与 retrieval signal explanations。
- [x] 4.3 增加 CLI 测试覆盖默认 answer、hybrid answer、top-k、JSON debug 输出和 vector fallback。

## 5. Spec And Documentation Sync

- [x] 5.1 确认 `answer-grounding`、`note-indexing`、`vector-indexing` delta 与 `hybrid-retrieval` 新能力一致。
- [x] 5.2 如实现中调整 CLI 选项名、metadata filter 字段或默认权重，同步更新本 change 的 design/spec/tasks。

## 6. Verification

- [x] 6.1 运行 `openspec status --change "hybrid-keyword-metadata-vector-retrieval"` 确认 artifacts apply-ready。
- [x] 6.2 运行 OpenSpec validation，确保 `hybrid-retrieval` 与相关 delta specs 可归档。
- [x] 6.3 运行 TypeScript typecheck。
- [x] 6.4 运行 Vitest 测试。
- [x] 6.5 运行 ESLint / Prettier 检查。
- [x] 6.6 运行 build，确认 CLI 产物可生成。