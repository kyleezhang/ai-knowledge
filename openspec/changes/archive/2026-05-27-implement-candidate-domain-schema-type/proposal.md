## Why

Candidate 是后续自动采集链路的入口对象，但当前代码中还没有 `Candidate` domain schema/type，导致 Candidate 与 Source 的对象边界只能停留在文档层。

本变更先补齐 Candidate 的 domain 契约与 invariant 校验，为后续 Candidate 存储、采集、推荐和转换 Source 打基础，但不接入 workflow 或 CLI。

## What Changes

- 新增 `Candidate` domain schema/type，覆盖最小字段、状态枚举、来源类型与评分结构。
- 新增 `CandidateStatusSchema`、`CandidateSourceTypeSchema`、`CandidateSchema` 与 `parse_candidate`。
- 增加 Candidate invariant 校验：
  - `score.breakdown` 固定包含 `relevance`、`learning_value`、`novelty`、`discussability`。
  - 每个 score 子项范围为 0-3。
  - `score.total` 必须等于 breakdown 汇总。
  - `status = converted` 时 `converted_source_id` 必须非空。
  - 非 converted 状态下 `converted_source_id` 应保持 `null`。
- 增加 domain 单元测试覆盖合法 Candidate、非法 score、非法转换状态、source_type/status 枚举。

Non-goals:

- 不新增 Candidate storage/repo。
- 不新增 `candidate list` / `candidate show` / `candidate select` CLI。
- 不实现 GitHub Trending / Hacker News collector。
- 不实现 Candidate 去重、过滤、评分推荐或转 Source workflow。
- 不让 Candidate 进入主索引或 answer 检索。

Scope: P0/P2 前置 domain 基础。该变更只实现 schema/type 与 invariant，不开启自动采集流程。

## Capabilities

### New Capabilities

- `candidate-domain`: 定义 Candidate domain object 的 schema、type、状态枚举、来源类型、评分结构与 invariant 校验。

### Modified Capabilities

- 无。

## Impact

- Affected layers:
  - domain: 新增 `src/domain/candidate.ts`。
  - tests: 新增 `tests/domain/candidate.test.ts`。
- API / data impact:
  - 新增 TypeScript/Zod domain API，但不改变现有 CLI、workflow、storage 行���。
  - 不写入 `knowledge/candidates/`，不创建 Source，不影响 Note/Index/Answer。
- Dependencies:
  - 不新增运行时依赖。
