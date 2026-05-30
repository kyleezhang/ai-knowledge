## Why

Candidate 自动采集链路已经具备 collector、storage、dedupe/filter/score、select 并转换 Source 的核心能力，但目前缺少端到端验收来证明这些能力可以从空 `knowledge/` 串到完整 Source -> Note -> Answer 主链路。

本变更补齐自动采集候选池端到端验收，验证 Candidate 不会绕过用户选择、讨论确认、QA 和索引门槛。

## What Changes

- 新增 GitHub Trending / Hacker News deterministic fixtures。
- 新增自动采集候选池端到端验收测试。
- 验收从空 `knowledge/` 开始，覆盖：
  - collect Candidate
  - dedupe / filter / score
  - recommended Candidate
  - candidate select
  - Source process / understand / discuss / approve
  - Note compose / lint / approve / index
  - answer
- 验收确认：
  - Candidate 不直接进入 Index。
  - 未选中 Candidate 不创建 Source。
  - dismissed Candidate 不进入 Source。
  - 转换后的 Source 继续复用既有 Source -> Note -> Answer 主链路。
- 更新人工验收说明，补充自动采集候选池检查点。

Non-goals:

- 不引入真实网络依赖。
- 不使用真实 LLM 作为默认验收 gate。
- 不新增定时采集或后台调度。
- 不实现更多 collector 来源。
- 不改变 Candidate/Source/Note schema。

Scope: P2 自动采集候选池端到端验收。该变更只补充验收与文档，发现缺口时做最小修复。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `end-to-end-acceptance`: 增加自动采集候选池端到端验收，覆盖 Candidate collect -> recommend -> select -> Source -> Note -> Answer，并验证 Candidate 边界。

## Impact

- Affected layers:
  - tests: 新增 Candidate pool E2E acceptance。
  - docs/manual acceptance: 更新或新增人工验收说明。
  - workflows/CLI: 仅在验收暴露缺口时做最小修复。
- API / data impact:
  - 不改变对象 schema。
  - 不改变默认 `pnpm test` 仍 fake-agent / deterministic 的原则。
- Dependencies:
  - 不新增运行时依赖。
