## ADDED Requirements

### Requirement: Provide a stable P0 acceptance fixture
系统 MUST 提供一份稳定的 Markdown fixture，作为 P0 端到端验收的标准输入，并配套一个用于验证 grounded answer 的预设问题。该 fixture MUST 适合串起从 `source ingest markdown` 到 `answer` 的完整流程，且不依赖外部网络或私有数据。

#### Scenario: Use acceptance fixture from an empty knowledge directory
- **WHEN** 验收从空 `knowledge/` 目录启动，并使用该 Markdown fixture 执行 `ai-knowledge source ingest markdown <file>`
- **THEN** 系统可以基于这份输入继续完成后续 P0 各阶段，而不需要额外手工准备数据

### Requirement: Verify the complete P0 happy path end to end
系统 MUST 提供一条自动化端到端验收路径，串起 `ai-knowledge source ingest markdown`、`source process`、`source understand`、`source discuss`、`source approve`、`note compose`、`note lint`、`note approve`、`note index` 与 `answer`，并验证关键产物和最终输出。该验收 MUST 使用测试注入的 fake agents / fake REPL，而不能依赖真实 LLM。

#### Scenario: Complete the full P0 flow successfully
- **WHEN** 验收在隔离的临时工作目录中依次执行完整 P0 CLI 链路
- **THEN** 系统 MUST 生成 processed artifacts、discussion summary、`note.json`、`note.md`、approved Note、index entry，并返回引用 approved Notes 的 answer

### Requirement: Confirm note creation is blocked before discussion approval
端到端验收 MUST 显式确认在 discussion 尚未满足确认条件前，系统不能生成正式 Note。

#### Scenario: Reject note compose before discussion approval
- **WHEN** 验收执行到 `source discuss` 之后但尚未成功执行 `source approve`，并尝试运行 `ai-knowledge note compose <source_id>`
- **THEN** 系统 MUST 拒绝生成 Note，并保持 raw material、discussion-stage understanding、approved knowledge 之间的边界

### Requirement: Confirm note approval is blocked before QA passes
端到端验收 MUST 显式确认在 Note QA 未通过前，系统不能将 Note 推进为 `approved`。

#### Scenario: Reject note approve before lint passes
- **WHEN** 验收已经生成 draft Note，但尚未获得 `quality_checks.status = passed`，并尝试运行 `ai-knowledge note approve <note_id>`
- **THEN** 系统 MUST 拒绝批准该 Note，且不得生成可用于主检索的 approved Note 状态

### Requirement: Provide manual CLI acceptance guidance for HITL review
系统 MUST 提供人工验收步骤，指导评审者手动走一遍 CLI 命令并确认 discussion REPL 与关键输出体验可接受。该说明 MUST 标明要运行的命令、关键检查点，以及通过标准。

#### Scenario: Reviewer follows manual acceptance steps
- **WHEN** 评审者按照人工验收说明执行 fixture 导入、discussion REPL、approve、note 与 answer 命令
- **THEN** 评审者可以明确检查 CLI 交互体验、关键状态推进、落盘产物，以及最终问答结果是否满足 P0 预期
