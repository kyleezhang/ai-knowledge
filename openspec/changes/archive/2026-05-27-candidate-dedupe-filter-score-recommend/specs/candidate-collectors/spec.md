## MODIFIED Requirements

### Requirement: Collected items are saved as new Candidates
系统 SHALL 提供 collect workflow，将 collector 输出转换为 Candidate，并在保存前执行 Candidate 去重、过滤和评分推荐。Workflow MUST 设置系统控制字段，包括 Candidate id、`collected_at`、`scored_at`、score、status、`converted_source_id = null`。重复条目 MUST 作为 duplicate/skipped result 返回，不得创建新的推荐项。

#### Scenario: GitHub Trending collection succeeds
- **WHEN** 用户触发 GitHub Trending collection 且 collector 返回有效条目
- **THEN** workflow 对条目执行 dedupe/filter/scoring
- **AND** 非重复条目保存为 Candidate JSON 到 candidates storage
- **AND** Candidate status 根据 score threshold 进入 `recommended` 或 `dismissed`

#### Scenario: Hacker News collection succeeds
- **WHEN** 用户触发 Hacker News collection 且 collector 返回有效条目
- **THEN** workflow 对条目执行 dedupe/filter/scoring
- **AND** 非重复条目保存为 Candidate JSON 到 candidates storage
- **AND** Candidate status 根据 score threshold 进入 `recommended` 或 `dismissed`

#### Scenario: Collector returns duplicate item
- **WHEN** collector 返回的条目与现有 Candidate 重复
- **THEN** workflow MUST return duplicate/skipped result for that item
- **AND** 不创建新的 Candidate JSON
