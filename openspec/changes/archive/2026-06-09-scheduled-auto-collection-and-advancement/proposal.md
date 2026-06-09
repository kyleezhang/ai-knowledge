## Why

当前系统已经具备 Candidate 采集、本地任务运行时与前台 daemon，但采集和流程推进仍依赖用户手动逐条触发。增加定时自动采集与安全自动推进，可以让学习资料候选池持续更新，并把已满足前置条件的非人工确认步骤自动跑到下一处人工决策点。

本 change 属于 P2+ 范围，目标是在不破坏“原始资料 -> 讨论 -> 用户确认 -> approved Note”边界的前提下补齐自动化运行能力。

## What Changes

- 新增本地 schedule 配置与存储，用于描述定时触发的自动化规则。
- 新增定时采集能力：按配置周期触发 GitHub Trending / Hacker News 等现有 collector workflow，并只写入 Candidate。
- 新增安全自动推进能力：扫描已存在的 Candidate / Source / Note / LocalTask 状态，仅为满足工作流前置条件的非人工确认步骤创建或执行本地任务。
- 新增 CLI 入口，用于创建、启停、查看 schedule，并运行一次 scheduler tick。
- 新增 scheduler runner，与现有 LocalTask runtime 集成，复用 task runner、workflow gates、attempt/retry 记录。
- 自动推进 MUST 停在人工确认边界：不自动选择 Candidate 转 Source，不自动 approve Source，不自动 approve Note，不直接写主索引绕过 approved gate。
- 不引入数据库、后台系统服务、Web UI 或远端队列；本 change 仅使用本地文件系统和前台/脚本化 CLI。

## Capabilities

### New Capabilities
- `scheduled-automation`: 定义本地 schedule、scheduler tick、定时采集与安全自动推进的行为契约。

### Modified Capabilities
- `local-task-runtime`: 补充 scheduler 通过 LocalTask 入队和 daemon 执行任务时的边界要求。

## Impact

- Affected layers: domain, storage, workflows, CLI, tests。
- Domain: 新增 schedule schema、schedule 状态、自动推进策略枚举与校验。
- Storage: 新增 `knowledge/schedules/` 路径 helper 与 schedule repo。
- Workflows: 新增 schedule CRUD、scheduler tick、自动采集入队、自动推进规划与执行 workflow。
- CLI: 新增 `schedule` 资源命令，支持 list/show/create/enable/disable/tick/run 等本地操作。
- Tests: 增加 schedule domain/storage/workflow/CLI 测试，以及自动化不越过人工确认门槛的回归测试。
- Dependencies: 不新增数据库或远端队列依赖；如需 cron 表达式解析，优先实现最小 interval/daily 规则或使用轻量依赖并在实现前确认。
