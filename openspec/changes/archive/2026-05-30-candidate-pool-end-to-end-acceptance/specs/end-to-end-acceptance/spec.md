## ADDED Requirements

### Requirement: Verify auto-collected Candidate pool end to end
系统 MUST 提供自动采集候选池端到端验收，使用 mocked collector 或 deterministic fixture 跑通 Candidate collect、去重、过滤、评分、推荐、用户选择、转 Source，并复用既有 Source -> Note -> Answer 主链路。

#### Scenario: Candidate pool happy path completes
- **WHEN** 验收从空 `knowledge/` 目录开始并使用 mocked collector 采集 AI 相关条目
- **THEN** 系统 MUST 生成 recommended Candidate
- **AND** 用户选择后 MUST 转换为 ingested Source
- **AND** 转换后的 Source MUST 继续完成 process、understand、discuss、approve、note compose、lint、note approve、index、answer 链路

#### Scenario: Candidate does not bypass index
- **WHEN** Candidate 已创建但尚未转换为 approved Note
- **THEN** Candidate MUST NOT create main index entry
- **AND** answer MUST NOT use Candidate as evidence

#### Scenario: Unselected Candidate does not create Source
- **WHEN** Candidate 保持 recommended 但用户未执行 select
- **THEN** 系统 MUST NOT create Source from that Candidate

#### Scenario: Dismissed Candidate does not create Source
- **WHEN** Candidate 被过滤或评分后进入 dismissed 状态
- **THEN** candidate select MUST reject该 Candidate
- **AND** 不创建 Source

#### Scenario: Duplicate collected item is skipped
- **WHEN** mocked collector 返回重复 Candidate 条目
- **THEN** workflow MUST return duplicate/skipped result
- **AND** 不创建新的 Candidate JSON

### Requirement: Provide manual Candidate pool acceptance guidance
系统 MUST 提供人工验收说明，指导评审者检查自动采集候选池从 collect 到 answer 的完整链路，以及 Candidate 不绕过人工选择和 approved Note gate 的边界。

#### Scenario: Reviewer follows Candidate pool acceptance steps
- **WHEN** 评审者按照人工验收说明执行 candidate collect、list、select、source、note、answer 命令
- **THEN** 评审者可以检查 Candidate 状态、Source 转换、Note approval、Index entry 和 answer grounding

#### Scenario: Reviewer checks Candidate boundary rules
- **WHEN** 评审者检查 duplicate、dismissed、unselected Candidate
- **THEN** 说明文档 MUST 明确这些 Candidate 不应直接创建 Source、Index 或 answer evidence
