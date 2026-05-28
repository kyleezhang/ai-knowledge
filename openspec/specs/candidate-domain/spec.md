# Candidate Domain Specification

## Purpose

This capability defines the Candidate domain object contract used by future auto-collection, recommendation, and Candidate-to-Source workflows while keeping Candidate outside the main approved knowledge layer.

## Requirements

### Requirement: Candidate domain schema is defined
系统 SHALL 定义 Candidate domain object 的 Zod schema 与 TypeScript type。Candidate schema MUST 使用 snake_case 字段，并 MUST 表达自动采集候选项的基础元信息、来源类型、状态、评分、外部引用与转换后的 Source 引用。

#### Scenario: Parse a valid Candidate
- **WHEN** domain 层收到包含 id、source_type、title、summary、url、author、published_at、collected_at、scored_at、tags、status、score、external_ref、converted_source_id 的 Candidate JSON
- **THEN** `CandidateSchema` 能解析该对象
- **AND** TypeScript 可通过导出的 `Candidate` type 使用该对象

#### Scenario: Candidate fields use snake_case
- **WHEN** Candidate JSON 使用 `sourceType`、`publishedAt`、`convertedSourceId` 或其他 camelCase core field
- **THEN** schema parse MUST reject该对象

### Requirement: Candidate source type and status are constrained
系统 SHALL 约束 Candidate 的来源类型与状态枚举。`source_type` MUST 只允许 `github_trending` 或 `hacker_news`；`status` MUST 只允许 `new`、`recommended`、`dismissed`、`selected`、`converted`。

#### Scenario: Candidate uses supported source type and status
- **WHEN** Candidate 使用 `source_type = github_trending` 且 `status = recommended`
- **THEN** schema parse MAY succeed if all other fields are valid

#### Scenario: Candidate uses unsupported source type
- **WHEN** Candidate 使用 schema 未允许的 `source_type`
- **THEN** `CandidateSchema` MUST reject该对象

#### Scenario: Candidate uses unsupported status
- **WHEN** Candidate 使用 schema 未允许的 `status`
- **THEN** `CandidateStatusSchema` MUST reject该状态

### Requirement: Candidate score is validated
系统 SHALL 校验 Candidate 评分结构。`score.breakdown` MUST 固定包含 `relevance`、`learning_value`、`novelty`、`discussability`；每个子项 MUST 是 0 到 3 的 integer；`score.total` MUST 等于四个 breakdown 子项之和。

#### Scenario: Candidate score is valid
- **WHEN** Candidate score breakdown 为 `relevance = 3`、`learning_value = 3`、`novelty = 2`、`discussability = 2`
- **AND** `score.total = 10`
- **THEN** `parse_candidate` MUST accept该对象

#### Scenario: Candidate score item is out of range
- **WHEN** 任一 score breakdown 子项小于 0 或大于 3
- **THEN** `CandidateSchema` MUST reject该对象

#### Scenario: Candidate score total does not match breakdown
- **WHEN** `score.total` 不等于四个 breakdown 子项之和
- **THEN** `parse_candidate` MUST reject该对象
- **AND** 错误 MUST 表示 score total invariant 被破坏

### Requirement: Candidate conversion invariant is enforced
系统 SHALL 校验 Candidate 转换状态与 `converted_source_id` 的一致性。`status = converted` 时 `converted_source_id` MUST 非空；非 converted 状态时 `converted_source_id` MUST 为 `null`。

#### Scenario: Converted Candidate has source id
- **WHEN** Candidate `status = converted`
- **AND** `converted_source_id` 包含对应 Source id
- **THEN** `parse_candidate` MUST accept该对象 if all other fields are valid

#### Scenario: Converted Candidate has no source id
- **WHEN** Candidate `status = converted`
- **AND** `converted_source_id = null` 或空字符串
- **THEN** `parse_candidate` MUST reject该对象

#### Scenario: Non-converted Candidate has source id
- **WHEN** Candidate `status = recommended`、`new`、`dismissed` 或 `selected`
- **AND** `converted_source_id` 非空
- **THEN** `parse_candidate` MUST reject该对象

### Requirement: Candidate domain stays isolated from workflows and storage
系统 SHALL 允许 Candidate domain 被 Candidate storage 与只读查看 workflow 使用，但 Candidate MUST 仍保持在主知识层之外，不得绕过 Source、Discussion、Note、QA 或 Index gate。Candidate storage/read-only CLI 不得创建 Source、Note 或 Index Entry，也不得参与 answer retrieval。

#### Scenario: Candidate domain is implemented
- **WHEN** Candidate domain contract 存在
- **THEN** `src/domain/candidate.ts` 导出 `CandidateSchema`、`CandidateStatusSchema`、`CandidateSourceTypeSchema`、`Candidate`、`CandidateStatus`、`CandidateSourceType`、`parse_candidate`
- **AND** Candidate storage MAY use `parse_candidate` to validate persisted Candidate JSON
- **AND** Candidate read-only workflows MAY expose list/show behavior
- **AND** Candidate MUST NOT be written to main index
- **AND** Candidate MUST NOT be used directly as answer evidence
