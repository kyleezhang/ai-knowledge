## 1. Candidate pool E2E fixture and helpers

- [x] 1.1 新增 mocked collector / deterministic Candidate fixture，确保可稳定进入 recommended 状态。
- [x] 1.2 新增测试内 helper，串联 collect、candidate select、source、note、answer 主链路。
- [x] 1.3 复用 fake understand/discuss/note/answer agents，避免默认测试依赖真实 LLM。

## 2. Candidate pool happy path acceptance

- [x] 2.1 新增端到端测试：空 `knowledge/` -> collect -> recommended Candidate。
- [x] 2.2 验证 candidate select 后创建 ingested Source，并写入 Candidate/Source 双向引用。
- [x] 2.3 验证转换后的 Source 可 process / understand / discuss / approve。
- [x] 2.4 验证 Source 可生成 Note、lint、approve、index。
- [x] 2.5 验证 answer 引用 approved Note。

## 3. Candidate boundary acceptance

- [x] 3.1 验证 Candidate 创建后不直接写 main index。
- [x] 3.2 验证只有 Candidate 匹配问题时 answer 不使用 Candidate 作为 evidence。
- [x] 3.3 验证 unselected recommended Candidate 不创建 Source。
- [x] 3.4 验证 dismissed Candidate select 被拒绝且不创建 Source。
- [x] 3.5 验证 duplicate collected item 返回 duplicate/skipped，不创建新 Candidate。

## 4. Manual acceptance documentation

- [x] 4.1 新增或更新 Candidate pool manual acceptance 文档。
- [x] 4.2 文档列出 collect/list/select/source/note/answer 命令链路。
- [x] 4.3 文档列出 duplicate/dismissed/unselected/index/answer 边界检查点。

## 5. Verification

- [x] 5.1 运行 OpenSpec validation，确认 `candidate-pool-end-to-end-acceptance` 的 proposal、design、specs、tasks 均有效。
- [x] 5.2 运行 targeted Candidate pool E2E tests。
- [x] 5.3 运行完整 `pnpm test`。
- [x] 5.4 运行 `pnpm typecheck`。
- [x] 5.5 运行 `pnpm lint` 与 `pnpm format:check`。
- [x] 5.6 运行 `pnpm build`。
