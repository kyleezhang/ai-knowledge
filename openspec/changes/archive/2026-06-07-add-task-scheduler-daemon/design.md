## Context

项目已经有 filesystem-backed `LocalTask`、attempt history、retryable failure 和 `task enqueue/run/retry/list/show` CLI。当前缺口是执行模型仍是手动单步运行：用户必须反复执行 `ai-knowledge task run`，否则批量导入后的 processing、understanding、indexing、vector indexing 不会自动推进。

这个 change 在现有 local task runtime 上增加本地 daemon/scheduler。它不改变 Source、Note、Index Entry 的业务状态机，也不让 daemon 直接触碰知识对象；daemon 只负责持续挑选 eligible task，并复用现有 task runner 调用 workflow。

## Goals / Non-Goals

**Goals:**

- 提供 `ai-knowledge task daemon` 前台运行模式，持续执行本地任务队列。
- 支持有限运行参数，方便测试与脚本化：例如一次最多执行 N 个任务、空闲若干轮后退出、可配置轮询间隔。
- 只调度 eligible tasks：`pending` 以及达到 retry 条件的 `retryable_failed`。
- 防止多个 daemon 或 daemon 与手动 `task run` 重复执行同一个 task。
- 保留现有 task JSON、attempt history、retry 语义和 workflow gates。
- 提供可观测输出，让用户知道 daemon 何时运行任务、何时空闲、何时退出。

**Non-Goals:**

- 不实现远程 worker、分布式队列、服务注册或跨机器协调。
- 不实现 cron 表达式、定时采集规则或后台守护进程安装器。
- 不新增数据库或外部消息队列。
- 不改变 Source/Note/Index 的状态流转门槛，不允许 daemon 绕过讨论、QA、approved-only indexing 等规则。
- 不新增 PDF、URL、Candidate、vector 能力本身；daemon 只运行已有 task payload 支持的工作。

## Decisions

### Decision 1: daemon 作为 workflow/service 层循环，而不是 domain 能力

- 选择：新增 scheduler/daemon workflow 或 service，循环调用现有 task runner；domain 只描述 task 状态、lease/claim 等必要字段和校验。
- 原因：调度是编排职责，应该位于 workflow 层；业务动作仍由现有 workflows 完成。
- 替代方案：让 CLI 自己循环调用 `run_task_workflow`。这会把业务调度逻辑放进 CLI，难以测试，也容易绕开 storage/domain 约束。

### Decision 2: 使用本地原子 claim/lease 避免重复执行

- 选择：在 task 运行前通过 storage helper 原子领取 task，领取成功后才进入 runner；claim 信息应包含 daemon/runner 标识和时间。
- 原因：本项目以本地文件系统为主存储，不引入数据库；claim 必须由 storage 层保证路径安全和写入原子性。
- 替代方案：仅依赖 `status = running`。如果两个进程同时读取 pending，再分别写入 running，仍可能重复执行。

### Decision 3: retryable_failed 只有到期才可自动调度

- 选择：自动调度时尊重 retry policy 的延迟/退避；未到期的 `retryable_failed` task 保持等待。
- 原因：daemon 不能因为持续轮询而立刻打爆同一失败任务；失败历史必须可解释。
- 替代方案：所有 retryable_failed 都立即运行。实现简单，但会造成紧密失败循环。

### Decision 4: daemon 默认前台运行，并提供 bounded 模式

- 选择：`ai-knowledge task daemon` 默认持续前台运行；测试和脚本可通过 `--max-runs`、`--idle-exit-after`、`--poll-interval-ms` 等参数有界退出。
- 原因：前台模式最符合当前 CLI-first、本地工具定位；bounded 模式便于测试和一次性批处理。
- 替代方案：直接实现 OS-level daemon/install。会引入平台差异和生命周期复杂度，不适合当前 change。

### Decision 5: daemon 输出运行摘要，但不改变 task JSON 输出契约

- 选择：human output 显示 task id、type、status、attempt 和退出原因；如支持 `--json`，输出本次 daemon session 的结构化 summary。
- 原因：用户需要知道本地调度器是否在推进队列；现有 task 对象仍是每个任务的主记录。
- 替代方案：只输出每轮 `task run` 原始结果。信息冗余且不利于判断 daemon 是否空闲或退出。

## Risks / Trade-offs

- [Risk] 本地文件系统没有真正跨平台强锁语义 → Mitigation: 使用同目录临时文件、原子 rename/open exclusive 等 Node fs 能力实现最小 claim，并用测试覆盖并发 claim。
- [Risk] daemon 崩溃后 task 可能停留在 `running` 或 lease 未释放 → Mitigation: lease 带时间戳和过期语义，过期后允许后续 daemon 回收；attempt history 保留异常边界。
- [Risk] 自动 retry 可能重复触发外部 API 成本 → Mitigation: 自动调度尊重 retry policy 和 attempts 上限，默认不新增无限重试。
- [Risk] daemon 循环中运行 LLM 任务可能长时间占用前台 → Mitigation: 支持 graceful stop，在当前 task 完成后退出；长期后台化留给后续 change。
- [Risk] 多任务并发会扩大复杂度 → Mitigation: 本 change 默认单 worker 顺序执行；并发 worker 可作为后续增强。

## Migration Plan

- 现有 `LocalTask` 继续可读；新增字段应为可选或有默认值，避免破坏旧任务文件。
- 现有 `task enqueue/run/retry/list/show` 行为保持不变。
- 首次运行 daemon 不需要迁移已有 task；pending task 可被正常领取，已完成或 failed task 不会被重新执行。
- 若实现过程中发现必须改变 task schema，应同步更新 `openspec/specs/local-task-runtime/spec.md` delta 并提供旧文件兼容解析。

## Open Questions

- daemon CLI 参数最终命名是否采用 `task daemon`，还是 `task worker` / `task run --watch`？当前建议使用 `task daemon`，因为它更清楚表达持续调度。
- lease 默认过期时间采用多少？建议初始使用保守默认值，并允许 CLI/config 覆盖。
- 是否需要持久化 daemon session log？当前建议先只依赖 stdout 和 task attempt history，不新增日志文件。
