# P2 Experimental 自动采集候选池端到端人工验收步骤

## 阶段标签

- Phase: P2
- Stability: Experimental
- Scope: Candidate collect / score / select 与 Candidate -> Source 转换。
- Boundary: Candidate 不得直接进入主 Index 或 answer evidence，必须先经用户选择转换为 Source，并继续走 Source -> Discussion -> Note -> QA -> Index gates。

## 目的

验证自动采集内容必须先进入 Candidate 候选池，经过去重、过滤、评分、推荐与用户选择后才能创建 Source，并且后续仍然复用既有 Source -> Note -> Answer 主链路。

## 前置条件

- 默认自动化验收使用 mocked collector / fake agents，不依赖真实 GitHub、Hacker News 或真实 LLM。
- 人工验收可以使用真实 collector，但需要接受网络波动。
- 使用全新的临时工作目录，从空 `knowledge/` 开始。

## Happy path

1. 初始化知识库：

   ```bash
   ai-knowledge init
   ```

2. 采集候选：

   ```bash
   ai-knowledge candidate collect github-trending
   ai-knowledge candidate collect hacker-news
   ```

3. 查看候选池：

   ```bash
   ai-knowledge candidate list
   ai-knowledge candidate list --status recommended
   ai-knowledge candidate show <candidate_id>
   ```

4. 选择一个 recommended Candidate：

   ```bash
   ai-knowledge candidate select <candidate_id>
   ```

   记录输出中的 `<source_id>`。

5. 继续 Source 主链路：

   ```bash
   ai-knowledge source process <source_id>
   ai-knowledge source understand <source_id>
   ai-knowledge source discuss <source_id>
   ai-knowledge source approve <source_id>
   ```

6. 生成、QA、批准、索引 Note：

   ```bash
   ai-knowledge note compose <source_id>
   ai-knowledge note lint <note_id>
   ai-knowledge note approve <note_id>
   ai-knowledge note index <note_id>
   ```

7. 提问：

   ```bash
   ai-knowledge answer "candidate pool accepted knowledge"
   ```

## 关键检查点

- collect 后应生成 Candidate JSON：
  - `knowledge/candidates/YYYY/MM/<candidate_id>.json`
- recommended Candidate 才允许 select。
- select 后应生成 Source JSON：
  - `knowledge/sources/YYYY/MM/<source_id>/source.json`
- Source 应包含：
  - `ingest_type = candidate_selected`
  - `origin.type = candidate`
  - `origin_candidate_id = <candidate_id>`
- Candidate 应包含：
  - `status = converted`
  - `converted_source_id = <source_id>`
- select 后只创建 ingested Source，不应自动创建 Note 或 Index。
- 只有 approved Note index 后，answer 才能引用该知识。

## 边界检查

- Duplicate Candidate：
  - 重复采集同一 URL / external_ref / title slug。
  - 预期返回 duplicate/skipped，不创建新的 Candidate JSON。
- Dismissed Candidate：
  - 尝试 select dismissed Candidate。
  - 预期失败，不创建 Source。
- Unselected Candidate：
  - Candidate 保持 recommended 但不 select。
  - 预期不创建 Source。
- Candidate 不直接进入 Index：
  - collect 后、select 前检查 `knowledge/index/`。
  - 预期没有由 Candidate 直接产生的 index entry。
- Candidate 不直接作为 answer evidence：
  - 只有 Candidate、没有 approved Note 时提问。
  - 预期 answer 报告没有相关已确认知识。

## 通过标准

- 可以从空 `knowledge/` 采集出 recommended Candidate。
- 用户 select 后可以转换为 Source。
- 转换后的 Source 能完成 process / understand / discuss / approve / note / index / answer。
- duplicate、dismissed、unselected Candidate 不会绕过 Candidate/Source/Note gate。
