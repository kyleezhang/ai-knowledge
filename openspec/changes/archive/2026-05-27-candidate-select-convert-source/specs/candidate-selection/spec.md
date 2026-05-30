## ADDED Requirements

### Requirement: Candidate select converts recommended Candidate to Source
系统 SHALL 支持用户显式选择 recommended Candidate 并转换为 Source。转换 MUST 创建 `Source.status = ingested`，并将 Source 标记为来自 Candidate。

#### Scenario: User selects recommended Candidate
- **WHEN** 用户运行 `ai-knowledge candidate select <candidate_id>` 且 Candidate status 为 `recommended`
- **THEN** 系统 MUST 创建一个 Source
- **AND** Source status MUST 为 `ingested`
- **AND** Source ingest_type MUST 为 `candidate_selected`
- **AND** Source origin.type MUST 为 `candidate`
- **AND** Source origin_candidate_id MUST 等于该 Candidate id

#### Scenario: User requests JSON output
- **WHEN** 用户运行 `ai-knowledge candidate select <candidate_id> --json`
- **THEN** CLI MUST 输出 workflow result JSON

### Requirement: Candidate select enforces status gate
系统 SHALL 只允许 `recommended` Candidate 被选中转换。`new`、`dismissed`、`selected`、`converted` Candidate MUST NOT 被转换为新的 Source。

#### Scenario: User selects non-recommended Candidate
- **WHEN** 用户尝试选择 status 不是 `recommended` 的 Candidate
- **THEN** workflow MUST reject该操作
- **AND** 不创建 Source

#### Scenario: User selects missing Candidate
- **WHEN** 用户尝试选择不存在的 Candidate id
- **THEN** workflow MUST 返回 not found error
- **AND** 不创建 Source

### Requirement: Candidate conversion records bidirectional links
系统 SHALL 在 Candidate 和 Source 之间建立双向引用。Source MUST 记录原 Candidate id，Candidate converted 后 MUST 记录 `converted_source_id`。

#### Scenario: Conversion succeeds
- **WHEN** Candidate 成功转换为 Source
- **THEN** Candidate status MUST 更新为 `converted`
- **AND** Candidate converted_source_id MUST 等于新 Source id
- **AND** Source origin.candidate_id MUST 等于 Candidate id
- **AND** Source origin_candidate_id MUST 等于 Candidate id

#### Scenario: Candidate conversion is attempted twice
- **WHEN** Candidate 已经是 `converted` 或存在 converted_source_id
- **THEN** workflow MUST reject重复转换
- **AND** 不创建第二个 Source

### Requirement: Candidate conversion does not bypass Source gates
系统 SHALL 保证 Candidate 转换只创建 ingested Source，不得自动处理、理解、讨论、生成 Note 或写入 Index。

#### Scenario: Candidate conversion completes
- **WHEN** Candidate 转换成功
- **THEN** Source processing_artifacts MUST 为空
- **AND** Source draft_understanding MUST 为 null
- **AND** Source note_ids MUST 为空
- **AND** 不创建 Note 或 Index Entry
- **AND** workflow MUST 返回 next action `ai-knowledge source process <source_id>`
