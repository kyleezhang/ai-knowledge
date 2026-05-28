## MODIFIED Requirements

### Requirement: Candidate repository reads and lists Candidates
系统 SHALL 提供 Candidate repository，用于创建、读取和列出 Candidate。Repository MUST 在读写 JSON 时通过 `CandidateSchema` / `parse_candidate` 校验对象，并 MUST 支持按 status 过滤列表。Collector workflow MAY use repository create behavior to persist newly collected Candidates, but repository MUST still reject invalid Candidate JSON and MUST NOT write to Source、Note 或 Index storage.

#### Scenario: Read Candidate by id
- **WHEN** 调用 repository 读取已存在的 Candidate id
- **THEN** 系统返回通过 domain parse 的 Candidate 对象

#### Scenario: Candidate does not exist
- **WHEN** 调用 repository 读取不存在的 Candidate id
- **THEN** 系统返回 storage not found error

#### Scenario: List Candidates sorted by collected_at
- **WHEN** candidates root 下存在多个 Candidate JSON
- **THEN** list 默认按 `collected_at` 降序返回 Candidates

#### Scenario: List Candidates by status
- **WHEN** 调用 list 并指定 `status = recommended`
- **THEN** 只返回 status 为 `recommended` 的 Candidates

#### Scenario: Collector saves Candidate through repository
- **WHEN** collector workflow 通过 repository 保存新 Candidate
- **THEN** repository MUST validate the Candidate with `parse_candidate`
- **AND** Candidate JSON MUST be written only under candidates storage
- **AND** no Source、Note 或 Index file is created by the repository
