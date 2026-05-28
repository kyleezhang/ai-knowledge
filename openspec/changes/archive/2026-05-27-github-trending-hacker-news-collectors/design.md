## Context

Candidate domain 与 Candidate storage/read-only CLI 已经具备，系统现在可以保存和查看候选项，但还没有采集入口。Issue 20 要求新增 GitHub Trending 与 Hacker News collector，并将外部条目规范化为 Candidate 创建输入。

本变更位于 P2 自动采集链路的第一步：只负责发现外部条目并创建 Candidate。去重、过滤、评分推荐、用户选择和 Candidate -> Source 转换仍属于后续变更。采集器必须遵守核心边界：自动采集内容先进入 Candidate，不得直接创建 Source、Note 或 Index，也不得调用 Agent。

## Goals / Non-Goals

**Goals:**

- 新增 GitHub Trending collector。
- 新增 Hacker News collector。
- 将 collector 外部条目规范化为统一 Candidate 创建输入。
- 通过 Candidate repository 保存采集结果。
- 支持外部请求注入 / mock，测试不依赖真实网络。
- 采集失败返回结构化 workflow error，不产生半成品 Candidate。
- 确认 collector 不创建 Source、不调用 LLM、不生成 Note、不写 index。

**Non-Goals:**

- 不实现 dedupe。
- 不实现 relevance/filter/scoring/recommendation。
- 不实现 scheduled collection。
- 不实现 Candidate select 或 convert to Source。
- 不引入数据库、队列、浏览器抓取或 authenticated API。
- 不采集泛内容作为主路径；collector fixture 应偏 AI 技术材料。

## Decisions

### Decision 1: Collector 输出统一 Candidate 创建输入

每个 collector 将外部条目先转换为内部 `CollectedCandidateInput`，再由 workflow 补充 id、collected_at、初始 status/score，并调用 Candidate repo 保存。

Rationale: GitHub Trending 和 Hacker News 字段差异较大，统一中间结构能避免 storage/workflow 直接依赖外部 API shape。

Alternative considered: collector 直接返回完整 Candidate。这样实现少一层，但会把 id、collected_at、初始 score/status 的系统控制字段分散到各 collector。

### Decision 2: 初始 Candidate 状态为 `new`，score 为零值

本阶段不做评分推荐。collector 保存的 Candidate 使用 `status = new`，score breakdown 四项为 0，`score.total = 0`，reason 表示尚未评分。

Rationale: Issue 21 会实现过滤、评分和推荐。这里若提前打分会跨范围，也会让推荐语义不稳定。

Alternative considered: collector 直接根据简单规则推荐。该方案会提前进入推荐逻辑，违反本变更 non-goal。

### Decision 3: 外部请求函数必须可注入

GitHub/HN collector 接受 fetcher 或等价 request function 注入；默认实现可用 Node `fetch`，但测试必须通过 mock input 覆盖成功和失败。

Rationale: 单元测试不能依赖真实网络，也不能受 GitHub/HN 页面结构变化影响。

Alternative considered: 测试访问真实 GitHub/HN。会引入网络不稳定和速率限制，因此不采用。

### Decision 4: CLI 提供手动触发一次采集

新增显式命令用于手动运行 collector，例如 `ai-knowledge candidate collect github-trending` 与 `ai-knowledge candidate collect hacker-news`，并支持 `--json`。该命令只写 Candidate，不做推荐或转换。

Rationale: 没有 CLI 就很难手动使用 collector；命令名称放在 candidate group 下，避免让用户误以为它会进入 Source 主流程。

Alternative considered: 只提供 workflow API。对 CLI-first 产品不可用，不利于验收。

## Risks / Trade-offs

- [Risk] GitHub Trending 页面 HTML 结构变化。→ Mitigation: parser 保持保守；失败返回结构化错误；测试使用 fixture。
- [Risk] Hacker News API 或页面字段缺失。→ Mitigation: mapper 支持可选 author/published_at；缺失时使用 null 或合理 fallback。
- [Risk] 采集结果重复。→ Mitigation: 本变更不做 dedupe；若 repo 已存在同 id，可将 already exists 作为可见错误或跳过策略由实现明确，真正 dedupe 留 Issue 21。
- [Risk] 用户误以为采集会自动进入学习流程。→ Mitigation: CLI 输出和 spec 明确只创建 Candidate，后续需要推荐和选择。

## Migration Plan

1. 新增 collector 模块与统一 collected candidate input type。
2. 实现 GitHub Trending mapper/parser。
3. 实现 Hacker News mapper/parser。
4. 新增 collect candidates workflow，调用 collector 并保存 Candidate。
5. 新增 `candidate collect` CLI 子命令。
6. 添加 collector、workflow、CLI、isolation tests。

Rollback strategy: 该变更新增 collector/workflow/CLI 命令和测试；回滚时删除新增模块和 CLI 接入，不影响已有 Candidate/Source/Note 数据结构。

## Open Questions

- GitHub Trending 默认采集哪个 language/time range？实现阶段可先用默认 trending page 或 fixture，不在 schema 中固化筛选策略。
- HN 使用 Algolia API 还是 official Firebase API？实现阶段优先选择更易 mock、字段稳定的方式；测试不依赖真实请求。

## Verification Strategy

- `openspec validate "github-trending-hacker-news-collectors" --strict`
- collector unit tests with mocked external responses
- workflow tests for save/error/isolation
- CLI tests for manual collect commands and JSON output
- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm format:check`
- `pnpm build`
