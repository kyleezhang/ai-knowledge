## MODIFIED Requirements

### Requirement: Candidate conversion invariant is enforced
系统 SHALL 校验 Candidate 转换状态与 `converted_source_id` 的一致性。`status = converted` 时 `converted_source_id` MUST 非空；非 converted 状态时 `converted_source_id` MUST 为 `null`。`selected` 表示用户已开始转换但尚未成功写入 Source id。

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

#### Scenario: Selected Candidate has no source id
- **WHEN** Candidate `status = selected`
- **AND** `converted_source_id = null`
- **THEN** `parse_candidate` MAY accept该对象 if all other fields are valid
