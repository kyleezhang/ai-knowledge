## 1. Spec Deltas

- [x] 1.1 更新 `answer-grounding` spec，定义 direct approved Notes 与 related approved Notes 的 evidence role，并保持 answer grounded in `note.json`。
- [x] 1.2 更新 `related-notes` spec，定义 confirmed `related_note_ids` 可用于 one-hop answer context expansion，但不得自动创建关系。
- [x] 1.3 更新 `hybrid-retrieval` spec，定义 direct retrieval results 可触发 related expansion，且 retrieval metadata 不是 answer evidence。

## 2. Domain And Retrieval Contracts

- [x] 2.1 新增或扩展 answer retrieval result 类型，包含 `retrieval_role = direct | related`、`related_via_note_id`、debug reason 等字段，保持 snake_case。
- [x] 2.2 增加 Zod schema / validator，确保 related result 有合法 `related_via_note_id`，direct result 不需要 related metadata。
- [x] 2.3 增加配置常量或 options，定义 `related_context_limit` 和 `related_per_direct_note_limit` 默认值。
- [x] 2.4 增加 domain / retrieval contract 测试覆盖 role schema、非法 role、缺失 `related_via_note_id`、cap option。

## 3. Retrieval Expansion

- [x] 3.1 在 approved-note retrieval 后增加 one-hop related expansion helper，从 direct notes 的 `related_note_ids` 收集候选。
- [x] 3.2 加载 related Note 时只保留 `status = approved`，跳过 draft / archived / superseded / missing / unloadable Note 并记录 debug。
- [x] 3.3 对 direct 与 related 结果去重；同一 note 同时 direct 和 related 时保留 direct role。
- [x] 3.4 应用 per-direct 和 total related cap，记录被截断数量或 skipped reason。
- [x] 3.5 增加 retrieval 测试覆盖 related approved inclusion、non-approved skip、missing skip、dedupe、cap。

## 4. Answer Workflow Integration

- [x] 4.1 修改 answer workflow，使 default retrieval 和 hybrid retrieval 都能触发 related expansion。
- [x] 4.2 保证传给 Answer Agent 的 approved notes 顺序为 direct first、related after。
- [x] 4.3 保持 fallback-unconfirmed 逻辑独立：related approved Notes 不影响 unconfirmed material 标注规则。
- [x] 4.4 增加 workflow 测试，确认 Answer Agent 只收到 approved Notes，不收到 raw Source / draft / discussion 作为 confirmed evidence。

## 5. CLI And Output

- [x] 5.1 保持 `ai-knowledge answer` 现有命令形态，不新增必需参数。
- [x] 5.2 扩展 `answer --json` 输出，包含 direct / related role、`related_via_note_id` 和 related expansion debug。
- [x] 5.3 人类可读输出可保持现有结构；如展示 related Notes，必须清楚区分“相关补充”而非直接命中。
- [x] 5.4 增加 CLI 测试覆盖 default answer JSON、hybrid answer JSON、related skipped debug。

## 6. Verification

- [ ] 6.1 运行 OpenSpec validation，确认本 change 的 spec deltas 可应用并且 apply-ready。（blocked: local `openspec` command not found）
- [x] 6.2 运行 `pnpm typecheck`。
- [x] 6.3 运行 `pnpm test`。
- [x] 6.4 运行 `pnpm lint`。
- [x] 6.5 运行 `pnpm format:check`。
- [x] 6.6 运行 `pnpm build`。
