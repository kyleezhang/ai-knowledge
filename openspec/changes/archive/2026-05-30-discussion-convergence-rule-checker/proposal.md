## Why

当前 `discussion_summary.ready_for_approval` 主要来自讨论流程和 Agent 输出更新，容易把“模型认为可以收敛”和“系统规则允许收敛”混在一起。为了守住“先讨论，后落笔”和“用户确认后才生成 Note”的边界，需要一个确定性的讨论收敛规则检查器，在批准 Source 之前统一检查 confirmed/open/unresolved 等结构化字段。

本变更属于 P0/P1 交界处的 workflow hardening：不改变讨论产品形态，只把已有 discussion convergence gate 变成可测试、可复用的 domain/workflow 规则。

## What Changes

- 新增确定性 convergence checker，用于判断 `discussion_summary` 是否满足可批准条件。
- checker 至少检查：`confirmed_points` 非空、`open_questions` 为空、blocking `unresolved_issues` 为空、`ready_for_approval = true`、Source 处于可批准讨论状态。
- `source approve` workflow MUST 使用 checker，而不是分散的局部条件判断。
- `source discuss` 更新 `discussion_summary` 后 MUST 通过 checker 规范化 readiness：不满足规则时不得保留 `ready_for_approval = true`。
- CLI 在拒绝 approval 时返回明确原因，帮助用户继续讨论补齐缺口。
- 非目标：不引入新的 LLM 判断、不自动批准 Source、不生成 Note、不改变 Note QA/index gates、不新增 Web UI、不修改 Candidate 或 retrieval 流程。

## Capabilities

### New Capabilities

### Modified Capabilities

- `discussion-convergence`: 增加确定性讨论收敛规则检查器，规范 `ready_for_approval` 的设置和 Source approval 的前置检查。
- `source-lifecycle`: Source approval 需要依赖 convergence checker 的通过结果，保持 `discussing -> approved_for_note` gate 不可绕过。

## Impact

- Affected layers: domain, workflows, CLI, tests。
- Domain: 增加 convergence check result 类型与检查函数，不写文件、不调用 Agent。
- Workflow: discuss/approve workflows 使用 checker 规范 readiness 和 approval rejection。
- CLI: approval/discuss 输出可展示规则失败原因。
- Tests: 覆盖 checker truth table、discussion summary normalization、approval rejection/acceptance、CLI 错误提示。
