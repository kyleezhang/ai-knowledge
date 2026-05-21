## Context

当前仓库已经完成 P0 issue 1-11，并分别通过单项 workflow / CLI / domain 测试验证了各阶段能力，但还没有一套固定输入把整条链路串起来验证。Issue 12 的目标不是新增运行时能力，而是补上一组稳定的验收资产，证明以下链路可以可靠工作：`Markdown -> Source -> Processed Artifacts -> Draft Understanding -> Discussion Summary -> Approval -> Note JSON -> Note Markdown -> QA -> Approved Note -> Index Entry -> Answer`。

这个验收设计还需要满足几个约束：

- 继续严格保留 raw material、discussion-stage understanding、approved Note 之间的边界。
- 自动化测试不能依赖真实 LLM 或外部网络请求。
- 验收必须可以从空 `knowledge/` 目录启动，避免污染仓库内真实数据。
- 验收需要覆盖关键 gate，而不是只覆盖 happy path。
- 人工验收仍然要保留 discussion REPL 的交互检查，因为它属于 HITL 范畴。

## Goals / Non-Goals

**Goals:**
- 提供一份稳定的 Markdown fixture 与预设提问，作为 P0 验收输入。
- 提供一条自动化 golden path，从 CLI 层串起完整 P0 流程，并验证落盘结果与最终 answer。
- 在自动化验收中显式覆盖两个关键 gate：未确认讨论不能 compose Note，未通过 QA 不能 approve Note。
- 提供一份人工 CLI 验收说明，用于确认 discussion REPL 与关键输出体验可接受。
- 让 Issue 12 成为后续 P0 回归验证的统一基线。

**Non-Goals:**
- 不扩展 PDF、auto-collection、vector retrieval、Web UI 或 database 范围。
- 不引入真实 LLM 调用、外部 API 依赖或新的运行时配置。
- 不修改 Source / Note / Index Entry schema，也不改变既有 CLI 命令契约。
- 不用一个“大而全”的验收测试替代现有 unit / workflow tests。

## Decisions

1. **将验收资产拆分为 fixture + 自动化测试 + 人工验收说明。**
   - Rationale: Issue 12 同时要求“有端到端验收步骤”和“人工确认 CLI 交互体验可接受”，只做文档或只做自动化都不够完整。
   - Alternatives considered:
     - 只写文档：可以指导人工执行，但不能形成稳定回归。
     - 只写自动化测试：可以回归，但无法覆盖 discussion REPL 的人工体验确认。

2. **自动化验收走 CLI 层，并复用现有测试注入点提供 fake `understand` / `discuss` / `compose_note` / `answer` / `repl_input`。**
   - Rationale: 这样可以验证用户真实会走到的命令路径，同时遵��“测试不得依赖真实 LLM”的项目规则。
   - Alternatives considered:
     - 直接测 workflow：覆盖更窄，无法验证 CLI 参数解析与输出约定。
     - 走真实模型：不稳定、依赖环境，且违反测试约束。

3. **自动化验收从隔离的临时工作目录启动，并断言关键文件与状态都被持久化。**
   - Rationale: Issue 12 强调“可以从空 `knowledge/` 跑到 approved Note”，因此不能只看命令返回值，必须验证真实文件系统结果。
   - Alternatives considered:
     - 复用仓库内固定 `knowledge/`：会产生状态泄漏，也会让验收不可并行。
     - 只断言 stdout：不足以证明对象、状态与索引真实落盘。

4. **关键 gate 校验直接纳入同一套端到端验收。**
   - Rationale: Issue 12 明确要求在验收中确认“没有讨论确认不能生成 Note”“没有 QA passed 不能 approve Note”，因此这些负向校验不应散落在无关测试里。
   - Alternatives considered:
     - 分散到独立单测：虽然也能测到，但不能体现“端到端验收已覆盖关键 gate”。

5. **人工验收说明只固定命令、检查点与通过标准，不固定整段 CLI 文案。**
   - Rationale: CLI 文案会随着迭代微调，但命令、状态与文件检查点更稳定，能减少文档漂移成本。
   - Alternatives considered:
     - 记录完整终端 transcript：更直观，但容易因非关键文案变化而失效。

## Risks / Trade-offs

- [Risk] 端到端验收与既有 workflow/CLI 测试存在覆盖重叠。 → Mitigation: 只保留一条 golden path 与两个必须 gate，避免把细节断言重复堆入验收用例。
- [Risk] 人工验收说明可能随着 CLI 文案细节变化而漂移。 → Mitigation: 聚焦命令、状态与产物检查点，而不是逐字匹配输出。
- [Risk] fake agent 输出会弱化对 prompt 集成的验证。 → Mitigation: 自动化验收负责回归稳定性，人工验收继续承担 HITL 体验确认。
- [Risk] 单一 fixture 不能代表全部学习资料。 → Mitigation: 将其定位为 P0 基线样例，而不是完整语料代表集。

## Migration Plan

- 无 schema、状态机或数据目录迁移。
- 实现只新增 fixture、验收说明与测试资产。
- 如需回滚，只需删除新增验收资产；既有运行时命令与数据格式保持不变。

## Open Questions

- None.
