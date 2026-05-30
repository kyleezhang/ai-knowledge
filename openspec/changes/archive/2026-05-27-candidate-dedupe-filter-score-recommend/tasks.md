## 1. Candidate repository update support

- [x] 1.1 在 Candidate repository 中新增更新已存在 Candidate 的 API。
- [x] 1.2 更新时通过 `parse_candidate` 校验，并只写回 Candidate storage path。
- [x] 1.3 添加 repository update tests，覆盖更新成功、missing Candidate、无 Source/Note/Index 副作用。

## 2. Dedupe keys and duplicate detection

- [x] 2.1 新增 Candidate canonical key helpers，生成 canonical URL、external_ref key、title slug。
- [x] 2.2 新增 duplicate detection 纯函数，比较新条目与已有 Candidate。
- [x] 2.3 覆盖 canonical URL / external_ref / title slug 三类去重单元测试。

## 3. Filtering and scoring rules

- [x] 3.1 新增基础过滤规则，识别信息不足与明显不相关 Candidate。
- [x] 3.2 新增 deterministic scoring，计算 relevance、learning_value、novelty、discussability 四项 0-3 分。
- [x] 3.3 新增推荐阈值逻辑，更新 status 为 `recommended` 或 `dismissed`。
- [x] 3.4 score reason 必须解释推荐、未推荐或过滤原因。
- [x] 3.5 覆盖 filter/scoring/status/reason 单元测试。

## 4. Workflow integration

- [x] 4.1 新增 rescore Candidate workflow，读取 Candidate、重新过滤评分、保存更新。
- [x] 4.2 更新 collect candidates workflow，保存前执行 dedupe/filter/scoring。
- [x] 4.3 collect workflow 对重复项返回 duplicate/skipped result，不创建新 Candidate。
- [x] 4.4 确认 scoring/collect workflows 不创建 Source、Note、Index，也不调用 Agent。
- [x] 4.5 添加 workflow tests，覆盖 rescore、collect integration、duplicate、isolation。

## 5. CLI

- [x] 5.1 新增 `ai-knowledge candidate score <candidate_id>` 命令用于重新评分。
- [x] 5.2 score 命令支持 `--json` 输出。
- [x] 5.3 collect CLI 输出中展示 created / duplicate / dismissed / recommended 结果。
- [x] 5.4 添加 CLI tests，覆盖重新评分、JSON 输出、duplicate result。

## 6. Verification

- [x] 6.1 运行 OpenSpec validation，确认 `candidate-dedupe-filter-score-recommend` 的 proposal、design、specs、tasks 均有效。
- [x] 6.2 运行 targeted recommendation/workflow/CLI tests。
- [x] 6.3 运行完整 `pnpm test`。
- [x] 6.4 运行 `pnpm typecheck`。
- [x] 6.5 运行 `pnpm lint` 与 `pnpm format:check`。
- [x] 6.6 运行 `pnpm build`。
