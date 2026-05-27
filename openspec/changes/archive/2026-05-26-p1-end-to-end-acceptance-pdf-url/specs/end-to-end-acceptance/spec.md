## ADDED Requirements

### Requirement: Provide stable P1 PDF and URL acceptance fixtures
系统 MUST 提供稳定的 P1 PDF 与显式公开 URL 验收 fixture，使默认自动化验收可以离线、确定性地验证 PDF/URL 输入扩展。PDF fixture MUST 可稳定产生可处理文本；URL fixture MUST 使用本地 test server、mocked fetch 或等价 deterministic public page，不依赖真实公网页面变化。

#### Scenario: PDF fixture is available for acceptance
- **WHEN** P1 PDF 端到端验收启动
- **THEN** 系统可以使用仓库内稳定 PDF fixture 或 deterministic PDF processor fixture 产生可处理文本
- **AND** 该验收不要求真实 LLM 或外部网络

#### Scenario: URL fixture is available for acceptance
- **WHEN** P1 URL 端到端验收启动
- **THEN** 系统可以使用 mocked public page、本地 test server 或等价 deterministic HTML fixture 完成 URL ingest 与 process
- **AND** 该验收不依赖真实公网页面内容或远程 headers 稳定性

### Requirement: Verify the complete P1 PDF happy path end to end
系统 MUST 提供一条自动化端到端验收路径，串起 PDF 输入从 `source ingest pdf` 到 `answer` 的完整学习闭环。默认验收 MUST 使用 fake agents / deterministic fixtures，且 MUST 验证 processed artifacts、draft understanding、discussion summary、approved Note、index entry 与 answer。

#### Scenario: Complete the full PDF flow successfully
- **WHEN** 验收在隔离的临时工作目录中以 PDF fixture 执行完整 CLI 或 workflow 链路
- **THEN** 系统 MUST 生成 `processed/clean_text.md`、`processed/segments.json`、`processed/metadata.json`
- **AND** processed segments MUST 包含 PDF locator metadata
- **AND** 系统 MUST 生成 draft understanding、closed discussion summary、`note.json`、`note.md`、approved Note、index entry
- **AND** 最终 answer MUST 引用 approved Note，而不是 raw PDF、draft understanding 或 discussion summary

### Requirement: Verify the complete P1 URL happy path end to end
系统 MUST 提供一条自动化端到端验收路径，串起显式公开 URL 输入从 `source ingest url` 到 `answer` 的完整学习闭环。默认验收 MUST 使用 fake agents / deterministic URL fixture，且 MUST 验证 frozen snapshot、processed artifacts、approved Note、index entry 与 answer。

#### Scenario: Complete the full URL flow successfully
- **WHEN** 验收在隔离的临时工作目录中以 deterministic URL fixture 执行完整 CLI 或 workflow 链路
- **THEN** 系统 MUST 保存 URL frozen snapshot
- **AND** 系统 MUST 生成 `processed/clean_text.md`、`processed/segments.json`、`processed/metadata.json`
- **AND** processed segments MUST 包含 URL locator metadata
- **AND** 系统 MUST 生成 draft understanding、closed discussion summary、`note.json`、`note.md`、approved Note、index entry
- **AND** 最终 answer MUST 引用 approved Note，而不是 raw HTML、draft understanding 或 discussion summary

### Requirement: Verify P1 input failure paths are explicit
端到端验收 MUST 覆盖 PDF/URL 输入扩展的关键失败路径，并确认错误可见、状态不被错误推进、raw material 不被改写来掩盖失败。

#### Scenario: URL fetch fails explicitly
- **WHEN** URL ingest 的 fetcher 返回网络错误、权限错误或其他 fetch failure
- **THEN** 验收 MUST 确认 workflow 或 CLI 返回失败
- **AND** 错误信息 MUST 明确表示 URL fetch 失败

#### Scenario: URL content type is unsupported
- **WHEN** URL ingest 收到不支持的网页 `content-type`
- **THEN** 验收 MUST 确认 workflow 或 CLI 返回失败
- **AND** 错误信息 MUST 明确表示 content type 不受支持

#### Scenario: PDF extraction fails explicitly
- **WHEN** PDF processing 无法抽取可用文本或 processor 抛出解析错误
- **THEN** 验收 MUST 确认 workflow 或 CLI 返回失败
- **AND** 错误信息 MUST 明确表示 PDF processing 或 text extraction 失败
- **AND** raw PDF MUST 仍保留在 Source raw artifact 中

### Requirement: Reconfirm core workflow gates for P1 inputs
P1 PDF/URL 端到端验收 MUST 继续确认核心 workflow gates：没有 discussion convergence 与 source approval 不能生成 formal Note；没有 QA/lint passed 不能 approve Note。

#### Scenario: Reject PDF or URL note compose before discussion approval
- **WHEN** PDF 或 URL Source 已产生 draft understanding 但尚未成功执行 `source approve`
- **THEN** `note compose` MUST 被拒绝
- **AND** 系统不得从 raw material 或 draft_understanding 直接生成 formal Note

#### Scenario: Reject PDF or URL note approve before lint passes
- **WHEN** PDF 或 URL Source 已生成 draft Note 但尚未通过 `note lint`
- **THEN** `note approve` MUST 被拒绝
- **AND** 该 Note 不得进入 approved 状态或主索引

### Requirement: Provide manual P1 CLI acceptance guidance
系统 MUST 提供人工 P1 CLI 验收说明，指导评审者手动检查 PDF 与 URL 输入的 CLI 体验、状态推进、落盘产物、来源追溯和最终 answer。该说明 MUST 标明默认自动化验收不依赖真实 LLM 或公网；若说明包含真实 LLM smoke，则 MUST 明确其为本地显式触发。

#### Scenario: Reviewer follows P1 manual acceptance steps
- **WHEN** 评审者按照人工验收说明执行 PDF 与 URL fixture 的命令链路
- **THEN** 评审者可以检查 Source、processed artifacts、discussion REPL、Note、index、answer 与 source refs / evidence locator 是否可接受

#### Scenario: Reviewer checks failure path guidance
- **WHEN** 评审者按照人工验收说明检查 URL fetch failure、unsupported content-type 或 PDF extraction failure
- **THEN** 说明文档给出可执行或可模拟的检查方式
- **AND** 通过标准明确要求错误可见且 workflow gate 不被绕过
