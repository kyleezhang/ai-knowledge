## Why

GitHub Trending / Hacker News collectors can now create `new` Candidates, but without dedupe、过滤和评分，候选池会快速积累重复或低价值内容，用户仍然需要手动筛选大量噪音。

本变更实现 Candidate 去重、基础规则过滤与评分推荐，使采集结果只影响 Candidate 状态与 score，不自动进入 Source/Note/Index 主流程。

## What Changes

- 根据 canonical URL、external_ref、title slug 对 Candidate 做去重。
- 重复 Candidate 不创建新的推荐项，并返回可见的 duplicate / skipped 结果。
- 实现基础过滤规则，排除明显不相关内容。
- 实现 score breakdown 四项评分：`relevance`、`learning_value`、`novelty`、`discussability`。
- 达到推荐阈值时 Candidate 状态变为 `recommended`。
- 未达阈值或被过滤时 Candidate 状态变为 `dismissed`。
- `score.reason` 说明推荐或 dismiss 原因。
- 支持重新评分单个 Candidate。

Non-goals:

- 不实现 Candidate -> Source 转换或 `candidate select`。
- 不调用 LLM 进行评分。
- 不实现复杂 ML/向量推荐。
- 不实现定时调度。
- 不把 Candidate 写入 main index 或 answer retrieval。

Scope: P2 Candidate 推荐前置能力。该变更只处理候选池内的去重、过滤、评分和推荐状态。

## Capabilities

### New Capabilities

- `candidate-recommendation`: 定义 Candidate 去重、基础过滤、规则评分、推荐阈值、重新评分与状态更新行为。

### Modified Capabilities

- `candidate-collectors`: collector workflow 在保存 Candidate 前应复用 dedupe/recommendation 逻辑，避免重复或低价值内容成为推荐噪音。
- `candidate-storage`: Candidate repository 支持保存评分/状态更新后的 Candidate，并继续保证不写 Source/Note/Index。

## Impact

- Affected layers:
  - domain: 可能新增 Candidate 推荐相关纯函数，但不改变 Candidate schema。
  - workflows: 增加 score/recommend workflow，更新 collect workflow 接入 dedupe/filter/scoring。
  - storage: 可能需要 Candidate update/save 能力。
  - CLI: 增加或扩展 Candidate scoring/recommendation 命令，支持重新评分单个 Candidate。
  - tests: 覆盖 dedupe、filter、scoring、状态更新、collector 集成与隔离。
- API / data impact:
  - 更新现有 Candidate JSON 中的 `status`、`score`、`scored_at`。
  - 不创建 Source，不修改 Note/Index。
- Dependencies:
  - 不新增运行时依赖。
