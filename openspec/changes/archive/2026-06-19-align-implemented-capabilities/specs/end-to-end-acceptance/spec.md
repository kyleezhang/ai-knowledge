## MODIFIED Requirements

### Requirement: Verify the complete P0 happy path end to end
系统 MUST 提供一条自动化端到端验收路径，串起 `ai-knowledge source ingest markdown`、`source process`、`source understand`、`source discuss`、`source approve`、`note compose`、`note lint`、`note approve`、`note index` 与默认 `answer`，并验证关键产物和最终输出。默认验收 MUST 使用测试注入的 fake agents / fake REPL，而不能依赖真实 LLM。P0 happy path MUST remain Markdown-only and approved-Note-only by default; PDF、URL、Feishu、Candidate、vector、hybrid 和 fallback coverage MUST be documented as extended capability acceptance or smoke coverage rather than P0-only coverage.

#### Scenario: Complete the full P0 flow successfully
- **WHEN** 验收在隔离的临时工作目录中依次执行完整 P0 CLI 链路
- **THEN** 系统 MUST 生成 processed artifacts、discussion summary、`note.json`、`note.md`、approved Note、index entry，并返回引用 approved Notes 的 answer
- **AND** 该 P0 验收 MUST NOT require PDF、URL、Feishu、Candidate、vector、hybrid 或 fallback-unconfirmed 能力

#### Scenario: Default automated acceptance remains fake-agent based
- **WHEN** 常规 `pnpm test` 或默认端到端验收运行
- **THEN** 系统继续使用 fake agents / fake REPL 进行自动化验证
- **AND** does not require a real LLM provider or network access

#### Scenario: Extended capabilities are covered separately
- **WHEN** 验收说明覆盖 PDF、URL、Feishu、Candidate、vector、hybrid 或 fallback-unconfirmed
- **THEN** those checks MUST be labeled by their capability phase and stability
- **AND** they MUST NOT be described as required P0 Stable coverage

### Requirement: Provide manual CLI acceptance guidance for HITL review
系统 MUST 提供人工验收步骤，指导评审者手动走一遍 CLI 命令并确认 discussion REPL 与关键输出体验可接受。该说明 MUST 标明要运行的命令、关键检查点，以及通过标准。若存在真实 LLM smoke test 或扩展能力 smoke，其说明 MUST 明确前置环境变量、成本、波动边界、覆盖阶段和稳定性标签。

#### Scenario: Reviewer follows manual acceptance steps
- **WHEN** 评审者按照人工验收说明执行 fixture 导入、discussion REPL、approve、note 与 answer 命令
- **THEN** 评审者可以明确检查 CLI 交互体验、关键状态推���、落盘产物，以及最终问答结果是否满足 P0 Stable 预期

#### Scenario: Reviewer runs local smoke test guidance
- **WHEN** 评审者按照 smoke test 说明执行真实 LLM 集成检查
- **THEN** 说明文档明确指出该检查仅本地显式触发、依赖 provider API key、会消耗 token，且不要求逐字稳定输出
- **AND** 说明文档 MUST label any PDF、URL、Feishu、Candidate、vector or hybrid coverage as extended capability coverage

### Requirement: Maintain a single real LLM smoke entrypoint
系统 MUST 只维护一个真实 LLM smoke entrypoint。`pnpm test:smoke` MUST 是本地真实 LLM smoke 的统一入口，并 MAY 覆盖当前版本支持的 Markdown、PDF、显式 URL、飞书单文档、Candidate、vector 或 hybrid happy path。该 smoke MUST 明确区分 P0 Stable coverage 与 extended capability coverage，并 MUST NOT imply that extended capabilities are required for P0 Stable success.

#### Scenario: User runs the unified smoke command with provider key
- **WHEN** 用户运行 `pnpm test:smoke` 且已配置所需 provider API key
- **THEN** smoke MUST 使用真实 LLM 运行其声明覆盖的路径
- **AND** 输出每条路径的 source id、note id 与 answer summary 或等价调试信息
- **AND** 输出 MUST identify each path's phase and stability label when it is not P0 Stable

#### Scenario: User runs the unified smoke command without provider key
- **WHEN** 用户运行 `pnpm test:smoke` 但未配置所需 provider API key
- **THEN** smoke MUST 明确报告 skipped
- **AND** 不得伪装成 passed

#### Scenario: Additional real smoke entrypoint is proposed
- **WHEN** 后续变更需要新增真实 LLM smoke 覆盖
- **THEN** 该覆盖 MUST 合入统一 `pnpm test:smoke` 链路
- **AND** 不应新增长期维护的第二个真实 LLM smoke 命令

### Requirement: Unified smoke reports path-scoped diagnostics
统一 smoke MUST 在成功或失败时提供足够定位信息。至少 SHOULD 包含 workdir、每条已执行 path 的 phase/stability label、source id、note id，以及 answer conclusion 或 summary；失败时 MUST 标明失败 path。

#### Scenario: Unified smoke succeeds
- **WHEN** 所有声明覆盖路径均成功完成
- **THEN** smoke 输出 MUST 表示整体 passed
- **AND** 输出包含每条路径的标识、phase/stability label、source id、note id 与 answer summary

#### Scenario: Unified smoke fails in one path
- **WHEN** 任一路径命令失败、schema 校验失败、QA gate 失败或 answer grounding 失败
- **THEN** smoke MUST 以失败退出
- **AND** 错误信息 MUST 包含失败 path label、phase/stability label、workdir，以及已知的 source id 或 note id

#### Scenario: User keeps smoke workdir
- **WHEN** 用户运行 smoke 时传入 `--keep-workdir`
- **THEN** smoke MUST 保留临时工作目录
- **AND** 输出 workdir 供用户检查 raw artifacts、processed artifacts、Note、index 与 discussion logs

## ADDED Requirements

### Requirement: P0 and extended acceptance documents are separated
系统 SHALL 将 P0 Stable 验收说明与 extended capability smoke/acceptance 说明拆分为不同文档，或在同一文档中使用明确章节和标签分区。文件名或标题 MUST NOT 让 PDF、URL、Feishu、Candidate、vector、hybrid 或 fallback coverage 被误解为 P0 Stable 必需范围。

#### Scenario: P0 smoke document is read
- **WHEN** 用户打开 P0 smoke 或 P0 acceptance 文档
- **THEN** 文档 MUST state that P0 Stable covers Markdown-only learning loop and default approved-Note answer
- **AND** 文档 MUST NOT list PDF、URL、Feishu、Candidate、vector、hybrid or fallback-unconfirmed as P0 Stable requirements

#### Scenario: Extended smoke document is read
- **WHEN** 用户打开 extended capability smoke 或 acceptance 文档
- **THEN** 文档 MUST identify each covered path by phase and stability label
- **AND** 文档 MUST state that extended coverage does not relax Source -> Discussion -> Note -> QA -> Index gates
