# Candidate Recommendation Specification

## Purpose

This capability defines Candidate deduplication, filtering, deterministic scoring, recommendation thresholds, and rescoring while keeping Candidates outside the Source/Note/Index/Answer main knowledge flow.

## Requirements

### Requirement: Candidate dedupe uses canonical keys
系统 SHALL 根据 canonical URL、external_ref 和 title slug 对 Candidate 进行去重。若新采集条目与现有 Candidate 的任一 canonical key 命中，系统 MUST 将该条目标记为 duplicate/skipped，不得创建新的推荐项。

#### Scenario: Duplicate by canonical URL
- **WHEN** 新采集条目的 canonical URL 与现有 Candidate 相同
- **THEN** 系统 MUST 将其识别为 duplicate
- **AND** 不创建新的 Candidate JSON

#### Scenario: Duplicate by external ref
- **WHEN** 新采集条目的 `external_ref.platform` 与 `external_ref.id` 与现有 Candidate 相同
- **THEN** 系统 MUST 将其识别为 duplicate
- **AND** 不创建新的推荐项

#### Scenario: Duplicate by title slug
- **WHEN** 新采集条目的 title slug 与现有 Candidate 相同且没有更强 canonical key 可区分
- **THEN** 系统 MUST 将其识别为 duplicate

### Requirement: Candidate filter dismisses low-value items
系统 SHALL 提供基础过滤规则，用于排除明显不相关、信息不足或不适合学习讨论的 Candidate。过滤失败的 Candidate MUST 进入 `dismissed` 状态，并在 `score.reason` 中说明 dismiss 原因。

#### Scenario: Candidate lacks meaningful title or summary
- **WHEN** Candidate title 或 summary 信息不足以判断学习价值
- **THEN** 系统 MUST 将 Candidate 状态设为 `dismissed`
- **AND** `score.reason` MUST 说明信息不足

#### Scenario: Candidate is unrelated to AI learning scope
- **WHEN** Candidate 内容明显不属于 AI 技术学习材料范围
- **THEN** 系统 MUST 将 Candidate 状态设为 `dismissed`
- **AND** `score.reason` MUST 说明不相关原因

### Requirement: Candidate scoring produces fixed breakdown
系统 SHALL 使用 deterministic 规则计算 Candidate score breakdown。score breakdown MUST 包含 `relevance`、`learning_value`、`novelty`、`discussability` 四项，每项为 0 到 3 的 integer，`score.total` MUST 等于四项之和，`score.reason` MUST 解释评分结果。

#### Scenario: Candidate is scored
- **WHEN** Candidate 通过基础过滤
- **THEN** 系统 MUST 计算四项 score breakdown
- **AND** `score.total` MUST 等于 breakdown 汇总
- **AND** `score.reason` MUST 解释推荐或不推荐原因

### Requirement: Candidate recommendation threshold updates status
系统 SHALL 根据 score threshold 更新 Candidate status。达到阈值的 Candidate MUST 进入 `recommended`；未达到阈值的 Candidate MUST 进入 `dismissed`。该状态变化 MUST 只影响 Candidate，不得创建 Source、Note 或 Index Entry。

#### Scenario: Candidate reaches recommendation threshold
- **WHEN** Candidate score total 大于或等于推荐阈值
- **THEN** Candidate status MUST 更新为 `recommended`

#### Scenario: Candidate does not reach recommendation threshold
- **WHEN** Candidate score total 低于推荐阈值
- **THEN** Candidate status MUST 更新为 `dismissed`

#### Scenario: Candidate recommendation updates no main knowledge
- **WHEN** Candidate status 更新为 `recommended` 或 `dismissed`
- **THEN** 系统不得创建 Source
- **AND** 不得创建 Note
- **AND** 不得写入 main index

### Requirement: Candidate can be rescored
系统 SHALL 支持重新评分单个 Candidate。重新评分 MUST 重新运行过滤与评分规则，更新 `score`、`status` 与 `scored_at`，但不得改变 Candidate id、source_type、external_ref 或 converted_source_id。

#### Scenario: User rescores Candidate
- **WHEN** 用户请求重新评分一个可评分 Candidate
- **THEN** 系统 MUST 更新其 `score`、`status` 与 `scored_at`
- **AND** 保持 Candidate id 与来源信息不变

#### Scenario: User rescores missing Candidate
- **WHEN** 用户请求重新评分不存在的 Candidate id
- **THEN** 系统 MUST 返回 not found error
