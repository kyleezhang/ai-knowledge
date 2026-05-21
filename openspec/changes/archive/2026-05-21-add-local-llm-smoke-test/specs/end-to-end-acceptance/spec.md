## MODIFIED Requirements

### Requirement: Verify the complete P0 happy path end to end
系统 MUST 提供一条自动化端到端验收路径，串起 `ai-knowledge source ingest markdown`、`source process`、`source understand`、`source discuss`、`source approve`、`note compose`、`note lint`、`note approve`、`note index` 与 `answer`，并验证关键产物和最终输出。默认验收 MUST 使用测试注入的 fake agents / fake REPL，而不能依赖真实 LLM。除此之外，系统 MAY 提供一条本地显式触发的真实 LLM smoke test，作为非阻塞补充验证路径。

#### Scenario: Complete the full P0 flow successfully
- **WHEN** 验收在隔离的临时工作目录中依次执行完整 P0 CLI 链路
- **THEN** 系统 MUST 生成 processed artifacts、discussion summary、`note.json`、`note.md`、approved Note、index entry，并返回引用 approved Notes 的 answer

#### Scenario: Default automated acceptance remains fake-agent based
- **WHEN** 常规 `pnpm test` 或默认端到端验收运行
- **THEN** 系统继续使用 fake agents / fake REPL 进行自动化验证
- **AND** does not require a real LLM provider or network access

#### Scenario: Local real-LLM smoke test is run explicitly
- **WHEN** 用户显式运行本地 smoke test 入口并且 `DEEPSEEK_API_KEY` 已配置
- **THEN** 系统 MAY 使用真实 provider 运行固定 fixture 的关键链路检查
- **AND** 该检查不并入默认 `pnpm test` 或 CI 阻塞链路

### Requirement: Provide manual CLI acceptance guidance for HITL review
系统 MUST 提供人工验收步骤，指导评审者手动走一遍 CLI 命令并确认 discussion REPL 与关键输出体验可接受。该说明 MUST 标明要运行的命令、关键检查点，以及通过标准。若存在真实 LLM smoke test，其说明 MUST 明确前置环境变量、成本与波动边界。

#### Scenario: Reviewer follows manual acceptance steps
- **WHEN** 评审者按照人工验收说明执行 fixture 导入、discussion REPL、approve、note 与 answer 命令
- **THEN** 评审者可以明确检查 CLI 交互体验、关键状态推进、落盘产物，以及最终问答结果是否满足 P0 预期

#### Scenario: Reviewer runs local smoke test guidance
- **WHEN** 评审者按照 smoke test 说明执行真实 LLM 集成检查
- **THEN** 说明文档明确指出该检查仅本地显式触发、依赖 `DEEPSEEK_API_KEY`、会消耗 token，且不要求逐字稳定输出
