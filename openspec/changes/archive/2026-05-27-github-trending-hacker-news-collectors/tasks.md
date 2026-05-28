## 1. Collector domain types

- [x] 1.1 新增 collector 输出统一类型，例如 `CollectedCandidateInput`，覆盖 source_type、title、summary、url、author、published_at、tags、external_ref。
- [x] 1.2 新增 collector 错误类型或结果结构，表达 fetch/parse/normalize 失败。
- [x] 1.3 增加 Candidate 构造 helper，将 collector input 转成 `status = new`、零值 score、`converted_source_id = null` 的 Candidate。

## 2. GitHub Trending collector

- [x] 2.1 新增 GitHub Trending collector 模块，支持注入 fetcher 或 HTML fixture。
- [x] 2.2 解析 GitHub Trending repo 条目并映射 title、summary、url、author、tags、external_ref。
- [x] 2.3 GitHub collector 失败时返回结构化错误，不产生半成品 Candidate input。
- [x] 2.4 添加 GitHub collector 单元测试，使用 mocked HTML/response，不访问真实网络。

## 3. Hacker News collector

- [x] 3.1 新增 Hacker News collector 模块，支持注入 fetcher 或 JSON fixture。
- [x] 3.2 解析 HN story 条目并映射 title、summary、url、author、published_at、tags、external_ref。
- [x] 3.3 HN collector 失败时返回结构化错误，不产生半成品 Candidate input。
- [x] 3.4 添加 HN collector 单元测试，使用 mocked response，不访问真实网络。

## 4. Workflow and storage integration

- [x] 4.1 新增 collect candidates workflow，按 provider 调用 collector。
- [x] 4.2 workflow 将 collector output 转成 Candidate 并通过 Candidate repository 保存。
- [x] 4.3 workflow 返回 created Candidate summaries / ids 和结构化错误。
- [x] 4.4 确认 collect workflow 不创建 Source、Note、Index，也不调用 Agent。
- [x] 4.5 添加 workflow tests，覆盖 GitHub/HN 成功、collector 失败、Candidate-only 隔离。

## 5. CLI

- [x] 5.1 新增 `ai-knowledge candidate collect github-trending` 命令。
- [x] 5.2 新增 `ai-knowledge candidate collect hacker-news` 命令。
- [x] 5.3 collect 命令支持 `--json` 输出 workflow result。
- [x] 5.4 CLI 普通输出展示创建的 Candidate id/title/status/source_type。
- [x] 5.5 添加 CLI tests，覆盖 GitHub/HN collect、JSON 输出、错误输出。

## 6. Verification

- [x] 6.1 运行 OpenSpec validation，确认 `github-trending-hacker-news-collectors` 的 proposal、design、specs、tasks 均有效。
- [x] 6.2 运行 targeted collector/workflow/CLI tests。
- [x] 6.3 运行完整 `pnpm test`。
- [x] 6.4 运行 `pnpm typecheck`。
- [x] 6.5 运行 `pnpm lint` 与 `pnpm format:check`。
- [x] 6.6 运行 `pnpm build`。
