## MODIFIED Requirements

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

## ADDED Requirements

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
