# end-to-end-acceptance Specification

## Purpose
TBD - created by archiving change p0-end-to-end-acceptance. Update Purpose after archive.
## Requirements
### Requirement: Provide a stable P0 acceptance fixture
系统 MUST 提供一份稳定的 Markdown fixture，作为 P0 端到端验收的标准输入，并配套一个用于验证 grounded answer 的预设问题。该 fixture MUST 适合串起从 `source ingest markdown` 到 `answer` 的完整流程，且不依赖外部网络或私有数据。

#### Scenario: Use acceptance fixture from an empty knowledge directory
- **WHEN** 验收从空 `knowledge/` 目录启动，并使用该 Markdown fixture 执行 `ai-knowledge source ingest markdown <file>`
- **THEN** 系统可以基于这份输入继续完成后续 P0 各阶段，而不需要额外手工准备数据

### Requirement: Verify the complete P0 happy path end to end
系统 MUST 提供一条自动化端到端验收路径，串起 `ai-knowledge source ingest markdown`、`source process`、`source understand`、`source discuss`、`source approve`、`note compose`、`note lint`、`note approve`、`note index` 与 `answer`，并验证关键产物和最终输出。默认验收 MUST 使用测试注入的 fake agents / fake REPL，而不能依赖真实 LLM。除此之外，系统 MUST 提供且只维护一条本地显式触发的真实 LLM smoke test，作为非阻塞补充验证路径；该 smoke MUST 在一次运行中覆盖 P0 Markdown 与 P1 PDF/URL 的关键 happy path。

#### Scenario: Complete the full P0 flow successfully
- **WHEN** 验收在隔离的临时工作目录中依次执行完整 P0 CLI 链路
- **THEN** 系统 MUST 生成 processed artifacts、discussion summary、`note.json`、`note.md`、approved Note、index entry，并返回引用 approved Notes 的 answer

#### Scenario: Default automated acceptance remains fake-agent based
- **WHEN** 常规 `pnpm test` 或默认端到端验收运行
- **THEN** 系统继续使用 fake agents / fake REPL 进行自动化验证
- **AND** does not require a real LLM provider or network access

#### Scenario: Local real-LLM smoke test is run explicitly
- **WHEN** 用户显式运行本地 smoke test 入口并且 `DEEPSEEK_API_KEY` 已配置
- **THEN** 系统 MUST 使用真实 provider 运行固定 fixture 的关键链路检查
- **AND** 该检查不并入默认 `pnpm test` 或 CI 阻塞链路
- **AND** 该 smoke MUST 在同一次运行中覆盖 Markdown、PDF、URL 三类输入

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
系统 MUST 提供人工验收步骤，指导评审者手动走一遍 CLI 命令并确认 discussion REPL 与关键输出体验可接受。该说明 MUST 标明要运行的命令、关键检查点，以及通过标准。若存在真实 LLM smoke test，其说明 MUST 明确前置环境变量、成本与波动边界。

#### Scenario: Reviewer follows manual acceptance steps
- **WHEN** 评审者按照人工验收说明执行 fixture 导入、discussion REPL、approve、note 与 answer 命令
- **THEN** 评审者可以明确检查 CLI 交互体验、关键状态推进、落盘产物，以及最终问答结果是否满足 P0 预期

#### Scenario: Reviewer runs local smoke test guidance
- **WHEN** 评审者按照 smoke test 说明执行真实 LLM 集成检查
- **THEN** 说明文档明确指出该检查仅本地显式触发、依赖 `DEEPSEEK_API_KEY`、会消耗 token，且不要求逐字稳定输出

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

### Requirement: Maintain a single real LLM smoke entrypoint
系统 MUST 只维护一个真实 LLM smoke entrypoint。`pnpm test:smoke` MUST 是本地真实 LLM smoke 的统一入口，并 MUST 覆盖当前版本支持的 Markdown、PDF、显式 URL 三类输入 happy path。

#### Scenario: User runs the unified smoke command with provider key
- **WHEN** 用户运行 `pnpm test:smoke` 且已配置 `DEEPSEEK_API_KEY`
- **THEN** smoke MUST 使用真实 LLM 运行 Markdown、PDF、URL 三条路径
- **AND** 输出每条路径的 source id、note id 与 answer summary 或等价调试信息

#### Scenario: User runs the unified smoke command without provider key
- **WHEN** 用户运行 `pnpm test:smoke` 但未配置 `DEEPSEEK_API_KEY`
- **THEN** smoke MUST 明确报告 skipped
- **AND** 不得伪装成 passed

#### Scenario: Additional real smoke entrypoint is proposed
- **WHEN** 后续变更需要新增真实 LLM smoke 覆盖
- **THEN** 该覆盖 MUST 合入统一 `pnpm test:smoke` 链路
- **AND** 不应新增长期维护的第二个真实 LLM smoke 命令

### Requirement: Unified smoke uses real agents across P0 and P1 paths
统一 smoke MUST 在 Markdown、PDF、URL 三条路径中使用真实 LLM agent 完成 draft understanding、discussion、Note candidate composition 与 grounded answer。Smoke MAY 使用 deterministic fixtures 或本地/mock 输入降低 PDF/URL 外部不稳定性，但 MUST NOT 使用 fake agent outputs 替代真实 LLM agent 环节。

#### Scenario: Markdown path uses real agents
- **WHEN** unified smoke 运行 Markdown path
- **THEN** understand、discuss、note compose 与 answer MUST 由真实 LLM agent 输出驱动
- **AND** smoke MUST 验证最终 answer 引用 approved Note

#### Scenario: PDF path uses real agents
- **WHEN** unified smoke 运行 PDF path
- **THEN** PDF Source MUST 完成 ingest、process、understand、discussion approval、Note、lint、approval、index、answer 链路
- **AND** understand、discuss、note compose 与 answer MUST 由真实 LLM agent 输出驱动
- **AND** smoke MUST 验证 PDF processed artifacts 与 evidence locator 存在

#### Scenario: URL path uses real agents
- **WHEN** unified smoke 运行 URL path
- **THEN** URL Source MUST 完成 ingest、process、understand、discussion approval、Note、lint、approval、index、answer 链路
- **AND** understand、discuss、note compose 与 answer MUST 由真实 LLM agent 输出驱动
- **AND** smoke MUST 验证 frozen HTML snapshot、URL processed artifacts 与 evidence locator 存在

### Requirement: Unified smoke reports path-scoped diagnostics
统一 smoke MUST 在成功或失败时提供足够定位信息。至少 SHOULD 包含 workdir、每条已执行 path 的 source id、note id，以及 answer conclusion 或 summary；失败时 MUST 标明失败 path。

#### Scenario: Unified smoke succeeds
- **WHEN** Markdown、PDF、URL 三条路径均成功完成
- **THEN** smoke 输出 MUST 表示整体 passed
- **AND** 输出包含每条路径的标识、source id、note id 与 answer summary

#### Scenario: Unified smoke fails in one path
- **WHEN** 任一路径命令失败、schema 校验失败、QA gate 失败或 answer grounding 失败
- **THEN** smoke MUST 以失败退出
- **AND** 错误信息 MUST 包含失败 path label、workdir，以及已知的 source id 或 note id

#### Scenario: User keeps smoke workdir
- **WHEN** 用户运行 smoke 时传入 `--keep-workdir`
- **THEN** smoke MUST 保留临时工作目录
- **AND** 输出 workdir 供用户检查 raw artifacts、processed artifacts、Note、index 与 discussion logs

