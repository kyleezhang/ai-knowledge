## Context

当前系统已经具备三块基础能力：Candidate collector 可以手动采集 GitHub Trending / Hacker News 并落为 Candidate；LocalTask runtime 可以把本地异步工作持久化、运行、重试并由 daemon 前台循环执行；主知识链路已经通过 Source / Note 状态机和 workflow gates 保证用户确认边界。

缺口在于“何时触发”：采集、处理、理解、渲染、lint、index 等动作仍主要依赖用户逐条 CLI 调用。该设计引入本地 schedule 与 scheduler tick，让系统可以在用户启动前台 runner 或脚本定时调用时自动触发安全动作，但不引入后台常驻服务或远端队列。

## Goals / Non-Goals

**Goals:**

- 用本地文件系统持久化 schedule 配置，支持 enable / disable / list / show。
- 支持按 schedule 定时触发现有 Candidate collection workflow。
- 支持自动推进已满足前置条件的非人工确认步骤，并把推进结果记录为 LocalTask 或 workflow result。
- 复用现有 workflow gates，保证自动化不会绕过 discussion、approval、QA、approved-only indexing 等门槛。
- 支持单次 `schedule tick`，以及可由外部 cron、launchd 或现有 task daemon 驱动的前台运行模式。

**Non-Goals:**

- 不自动选择 Candidate 转 Source。
- 不自动 approve Source，不替用户确认讨论结论。
- 不自动 approve Note，不绕过 QA。
- 不把未确认 Source / draft Note 写入主 index。
- 不实现 Web UI、远端任务队列、数据库、系统级后台服务安装器。
- 不新增新的采集来源；本 change 只调度已有 collectors。

## Decisions

### 1. Schedule 作为独立 domain object

新增 `LocalSchedule` 对象，而不是把周期配置塞进 `LocalTask`。Schedule 描述“应该何时产生工作”，LocalTask 描述“一次已产生的工作及其 attempt 历史”。这样可以保持可审计性，也避免重复执行时修改历史 task。

替代方案是直接让 daemon 内置固定采集周期。该方案实现更快，但无法 list/show/disable，也难以测试不同策略。

### 2. Tick 是最小调度原语

实现 `schedule tick`，每次扫描 due schedules，生成对应 LocalTask 或直接调用安全 workflow，并更新 schedule 的 `last_run_at`、`next_run_at` 与运行摘要。持续运行模式只是在 tick 之上循环，不承担业务逻辑。

替代方案是实现完整 cron daemon。考虑当前项目 CLI-first、本地文件系统和 P2+ 范围，tick 更容易测试、可由外部 cron/launchd 组合，也避免跨平台后台服务复杂度。

### 3. 自动采集只创建 Candidate

定时采集 schedule 调用现有 `collect_candidates_workflow`。该 workflow 已保证 collector 只创建 Candidate，不创建 Source、Note 或 Index。Scheduler 不直接访问外部平台，也不绕过 collector 的 mockable boundary。

### 4. 自动推进采用 allowlist task 类型

自动推进只为安全步骤入队或执行 allowlist 内的 task 类型，例如：

- `source.process`：仅处理 `ingested` Source。
- `source.understand`：仅处理 `processed` Source。
- `note.render`：仅重渲染已有 Note 视图。
- `note.lint`：仅 lint `draft` Note。
- `note.index`：仅 index `approved` Note。

不进入 allowlist 的动作包括 `candidate.select`、`source.approve`、`note.compose`、`note.approve`。其中 `note.compose` 需要已确认 Source，但仍会生成正式知识草稿，默认保留为显式用户动作，避免自动化把讨论结果误转成正式 Note。

### 5. Scheduler 不直接改业务对象状态

Scheduler 可以创建 / 更新 schedule，自身可以创建 LocalTask；业务对象状态仍只能通过已有 workflow 或 task runner 改变。这样保持 domain -> storage -> workflow -> CLI 分层，避免 scheduler 成为第二套业务状态机。

### 6. 去重通过 deterministic payload key 控制

Scheduler 在入队前基于 task type、target id、关键 options 生成 stable dedupe key，避免每次 tick 为同一对象重复创建 pending task。若已有 pending/running/retryable_failed 同 key task，则跳过并记录 skipped reason。

### 7. 时间规则先支持最小集合

初始版本支持 `interval_minutes` 与 `daily_time` 两类 schedule rule。它们足以覆盖“每天早上采集”和“每 N 分钟推进一次”的主路径，同时避免引入复杂 cron parser。若未来需要 cron 表达式，再作为独立增量变更。

## Risks / Trade-offs

- [Risk] 自动推进误越过人工确认边界 → Mitigation: 使用 allowlist，spec 明确禁止 candidate.select / source.approve / note.compose / note.approve，并增加回归测试。
- [Risk] tick 重复创建任务导致任务堆积 → Mitigation: task payload dedupe key，入队前检查未终态 task。
- [Risk] 前台 runner 中断导致 schedule last_run_at 与 task 状态不一致 → Mitigation: schedule 只记录 tick 尝试摘要，业务执行历史以 LocalTask attempts 为准。
- [Risk] 本地时间和 UTC 时间混用 → Mitigation: schedule 存储 ISO UTC `last_run_at` / `next_run_at`，CLI 仅做人类可读展示。
- [Risk] 外部 collector 网络失败导致 schedule 持续失败 → Mitigation: 失败记录在 schedule 最近运行摘要或 LocalTask attempt 中，不删除 schedule；由 retry policy 和下次 tick 继续处理。

## Migration Plan

- `ai-knowledge init` 后续应创建 `knowledge/schedules/`，但已有工作区可在首次 schedule 写入时懒创建该目录。
- 不迁移已有 Candidate、Source、Note、Index 或 LocalTask 文件。
- 已有 CLI 命令行为保持不变；新增 `schedule` 命令为独立入口。
- 回滚时可禁用或删除 schedule 文件；已创建的 LocalTask 仍由现有 task runtime 管理。

## Open Questions

- 初始实现是否需要 `schedule run` 持续循环命令，还是只提供 `schedule tick` 并交给外部 cron/launchd 驱动？建议实现 bounded foreground run，便于测试和本地使用。
- 自动推进是否允许自动执行 `note.lint` 后立即自动 `note.approve`？建议不允许，Note approve 必须保持显式用户动作。
