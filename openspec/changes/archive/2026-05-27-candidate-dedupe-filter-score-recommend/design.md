## Context

Collectors 当前会把 GitHub Trending / Hacker News 条目作为 `new` Candidate 保存到候选池。Candidate schema 已经包含 `status` 与 `score`，但没有去重、过滤或推荐逻辑。Issue 21 要求：根据 canonical URL / external_ref / title slug 去重，过滤明显不相关内容，计算四项 score breakdown，并按阈值更新 `recommended` / `dismissed`。

本变更仍处于 Candidate 层，不创建 Source，不进入 Note 或 answer。它只提升候选池质量，让后续 `candidate select` 面向更少、更有解释性的候选项。

## Goals / Non-Goals

**Goals:**

- 实现 Candidate canonical key 生成：canonical URL、external_ref、title slug。
- 实现重复检测，避免创建新的推荐噪音。
- 实现基础过滤规则，排除明显不相关或信息不足的 Candidate。
- 实现 deterministic rule-based scoring，填充四项 score breakdown。
- 按推荐阈值更新 Candidate status：`recommended` 或 `dismissed`。
- 写入 `score.reason` 和 `scored_at`。
- 支持重新评分单个 Candidate。
- 让 collector workflow 接入 dedupe/filter/scoring。

**Non-Goals:**

- 不调用 LLM 打分。
- 不做 embedding/vector 相似度去重。
- 不实现用户反馈学习或个性化推荐。
- 不实现 Candidate -> Source。
- 不创建 Index Entry，不影响 answer retrieval。

## Decisions

### Decision 1: 去重使用 deterministic canonical keys

为 Candidate 生成三个 key：canonical URL、external_ref key、title slug。若任一 key 与现有 Candidate 命中，则视为重复。

Rationale: Issue 明确要求三类依据；deterministic key 便于测试和解释。

Alternative considered: 使用文本相似度。当前没有向量能力，且会引入复杂性，不采用。

### Decision 2: 过滤和评分使用规则，不调用 LLM

基础过滤基于字段完整性、来源相关 tag/关键词、低信息标题/摘要等规则。评分四项范围仍为 0-3，total 为总和。

Rationale: 评分需要可解释、可测试且不引入 token 成本。LLM 评分可作为后续增强。

Alternative considered: 直接让 LLM 判断推荐。会引入不稳定输出和成本，也不适合当前 Candidate 层。

### Decision 3: 推荐阈值先固定为配置常量

默认 threshold 可设为 8：`total >= threshold` -> `recommended`，否则 `dismissed`。过滤失败直接 dismissed，score reason 说明过滤原因。

Rationale: 简单规则足以支持首版推荐；后续可通过配置扩展。

Alternative considered: 多来源不同 threshold。当前需求未要求，先保持统一。

### Decision 4: Candidate repository 增加 update/save 能力

重新评分需要读取 Candidate、更新 score/status/scored_at，再保存回同一路径。该能力只写 Candidate JSON，不触碰 Source/Note/Index。

Rationale: 只读 repo 无法完成状态更新；但更新边界仍限定在 Candidate storage。

Alternative considered: 删除重建 Candidate。会破坏 id 稳定和文件路径，不采用。

## Risks / Trade-offs

- [Risk] 规则过滤过粗导致误 dismiss。→ Mitigation: reason 必须解释，后续可调整规则；当前不删除 Candidate，只更新状态。
- [Risk] 去重误判 title slug 相同但内容不同。→ Mitigation: title slug 作为 fallback key，优先 canonical URL/external_ref；重复结果可返回命中原因。
- [Risk] collector workflow 因重复返回错误影响采集体验。→ Mitigation: 重复应作为 skipped/duplicate result，而非整体失败。

## Migration Plan

1. 增加 Candidate repo update/save 能力。
2. 新增 recommendation/dedupe/filter/scoring 纯函数模块。
3. 新增 score/recommend Candidate workflow。
4. 更新 collect workflow，保存前执行 dedupe/filter/scoring。
5. 新增 CLI 重新评分命令，例如 `ai-knowledge candidate score <candidate_id>`。
6. 添加单元、workflow、CLI 与隔离测试。

Rollback strategy: 回滚时删除 recommendation 模块、workflow/CLI 接入和 repo update；已有 Candidate JSON 仍符合 schema，因为只更新既有 status/score/scored_at 字段。

## Open Questions

- duplicate Candidate 是否应该保存为 dismissed？当前设计倾向“不创建新的推荐项”，即新条目不落盘，workflow 返回 duplicate/skipped。
- `selected` Candidate 是否允许重新评分？当前倾向只允许 `new`、`recommended`、`dismissed` 重新评分，避免干扰后续 Source 转换流程。

## Verification Strategy

- `openspec validate "candidate-dedupe-filter-score-recommend" --strict`
- targeted recommendation/dedupe/filter/scoring tests
- workflow tests for collect integration and re-score
- CLI tests for re-score command
- full `pnpm test`、`pnpm typecheck`、`pnpm lint`、`pnpm format:check`、`pnpm build`
