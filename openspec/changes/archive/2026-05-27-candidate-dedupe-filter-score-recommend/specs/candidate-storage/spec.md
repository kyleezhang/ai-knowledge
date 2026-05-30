## ADDED Requirements

### Requirement: Candidate repository updates Candidate JSON
系统 SHALL 支持更新已存在的 Candidate JSON。Update MUST 通过 `parse_candidate` 校验更新后的 Candidate，并 MUST 只写回原 Candidate storage path，不得创建 Source、Note 或 Index Entry。

#### Scenario: Candidate is updated
- **WHEN** workflow 更新 Candidate score、status 或 scored_at
- **THEN** repository MUST validate the updated Candidate
- **AND** repository MUST write it to the existing Candidate JSON path

#### Scenario: Candidate update target is missing
- **WHEN** workflow 尝试更新不存在的 Candidate
- **THEN** repository MUST return not found error

#### Scenario: Candidate update does not affect main knowledge
- **WHEN** Candidate repository updates Candidate JSON
- **THEN** no Source、Note 或 Index file is created
