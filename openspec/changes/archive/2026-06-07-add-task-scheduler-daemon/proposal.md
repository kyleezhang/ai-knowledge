## Why

当前本地异步任务已经支持 enqueue/run/retry/list/show，但执行仍依赖用户手动触发 `task run`。这会让 Source processing、understanding、note indexing、vector indexing 等可异步步骤无法持续推进，尤其在批量导入、失败重试和长耗时任务场景下容易形成积压。

## What Changes

- 为现有 local task runtime 增加一个本地 daemon/scheduler 执行模式，持续从 `knowledge/tasks/` 领取 eligible tasks 并调用现有 task runner。
- 增加 daemon 生命周期控制能力：前台运行、有限轮次/空闲退出、优雅停止、运行状态观测。
- 增加 task eligibility 与调度规则：只执行 `pending` 与到期的 `retryable_failed` task；不执行 `running/succeeded/failed/cancelled` task。
- 增加并发安全约束：避免同一 task 被多个 daemon 实例重复执行，保留 append-only attempt history。
- 增加 CLI 入口，例如 `ai-knowledge task daemon` 或等价命令，用于启动本地任务调度循环。
- 本 change 属于 P0/P1 之间的工程化增强：不改变知识对象边界，不新增 Web UI，不引入数据库。
- Non-goals：不实现分布式队列、远程 worker、Web UI、cron 配置系统、PDF/URL/vector 能力本身，也不改变 Source/Note/Index 的业务门槛。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `local-task-runtime`: 在既有本地任务运行时上增加 daemon/scheduler 执行、任务领取、空闲策略、优雅停止和并发安全要求。

## Impact

- Affected layers:
  - domain：可能补充 task lease/lock、scheduler 状态或 retry due time 的 schema/validator。
  - storage：需要通过 helpers 读写 task，必要时增加原子 claim/lease 写入。
  - workflows：新增 daemon/scheduler workflow 或 service，复用现有 `run_task_workflow`/runner，不直接修改 Source/Note/Index。
  - CLI：新增启动 daemon 的命令和参数。
  - tests：新增调度循环、eligible task、retry、并发 claim、优雅停止的 Vitest 覆盖。
- No breaking changes: 现有 `task enqueue/run/retry/list/show` 行为保持兼容。
- Dependencies: 默认不新增外部服务；如需文件锁，优先使用 Node fs 原子写/rename/open flags 实现。
