## Context

当前 CLI workflow 主要同步执行：用户运行命令，workflow 立即读写 Source / Note / Index。随着 PDF/URL 处理、LLM understanding、Note indexing、vector indexing、fallback/hybrid retrieval 等能力变多，部分流程会变成长耗时或易失败操作。同步命令缺少统一任务记录、attempt 历史、可重试错误分类和可观察状态。

本设计引入本地 filesystem-backed task runtime。它不是后台 daemon，也不是外部队列；它是一个本地任务对象和 runner 契约，允许 CLI 将工作 enqueue 后由本地命令显式 run / retry。业务状态仍由现有 workflow 和 domain state-machine helpers 控制。

## Goals / Non-Goals

**Goals:**

- 定义 `LocalTask`、`TaskAttempt`、`RetryPolicy`、`TaskError` 的 schema 和状态机。
- 在 `knowledge/tasks/` 下持久化任务和 attempt 记录，所有路径通过 storage helpers。
- 支持 enqueue、run next、run specific task、retry failed task、list/show task。
- 将可重试失败与不可重试失败分开，记录 error code、message、stage、attempt number 和 timestamps。
- 让 runner 调用现有 workflows，而不是直接修改 Source / Note / Index 状态。
- 保持现有 P0 同步命令默认行为不变。

**Non-Goals:**

- 不引入外部队列、数据库、daemon、cron、分布式锁或 Web UI。
- 不让 task runtime 绕过 Source / Note / Index 的状态机和 gates。
- 不改变 formal Note 生成、approved Note indexing、vector indexing 的业务规则。
- 不自动后台执行任务；首版由 CLI 显式 `task run` 驱动。
- 不为所有未来任务设计复杂插件系统，只覆盖明确的本地 workflow payload。

## Decisions

### Decision 1: Task 是本地持久对象，不是进程句柄

`LocalTask` 保存为 JSON，包含 `task_id`、`type`、`status`、`payload`、`retry_policy`、`attempts`、`created_at`、`updated_at`、`result_ref`。任务状态反映业务执行进度，不依赖当前 Node 进程是否仍存在。

Rationale: CLI-first 项目不需要常驻服务；JSON task 便于查看、测试和手动恢复。

Alternatives considered:

- 使用 OS 进程后台执行并保存 PID：拒绝，因为跨 shell/session 不可靠，且难以保持业务状态一致。
- 引入 SQLite / queue dependency：拒绝，超出本地文件存储 baseline。

### Decision 2: Runner 只调用 workflow，不直接写业务对象

Task runner 根据 task type 调用对应 workflow，例如 `source.process` 调用 `process_source_workflow`，`source.understand` 调用 `understand_source_workflow`，`note.index` 调用 `index_note_workflow`。runner 只能更新 task JSON 和 attempt 记录。

Rationale: workflow 已承载 domain gates 和 state transitions；runner 直接改业务对象会破坏 layering。

Alternatives considered:

- Task runner 内联业务逻辑：拒绝，因为会重复 workflow rules 并引入状态漂移。

### Decision 3: Retry 基于 attempt 记录和 retry policy

每次执行生成 `TaskAttempt`。失败时根据 `retryable`、`max_attempts`、`attempt_count` 和错误类型决定 task 进入 `retryable_failed` 还是 `failed`。用户显式 retry 只能针对 `retryable_failed` task。

Rationale: 明确失败可恢复性，避免无限重试或重试不该重试的 gate violation。

Alternatives considered:

- 所有失败都可重试：拒绝，INVALID_STATE / schema validation 等通常需要人工修复。
- 自动无限重试：拒绝，本地 CLI 不应在无用户意识下反复调用 LLM 或写文件。

### Decision 4: Task payload 使用受控类型和 Zod validation

首版支持受控 task types：`source.process`、`source.understand`、`note.index`、`note.vector_index`。每类 payload 只包含 id、options 和 storage/workflow 参数引用，不嵌入大文本或 raw material。

Rationale: 小 payload 易审计，避免复制 raw material 或 credentials 到 task file。

Alternatives considered:

- 任意 command string task：拒绝，存在命令注入和不可验证风险。

### Decision 5: Task runtime 提供可观察 CLI

新增 `ai-knowledge task enqueue ...`、`task run`、`task retry <task_id>`、`task show <task_id>`、`task list`。JSON 输出必须机器可读，非 JSON 输出展示 status、attempts 和 next action。

Rationale: 本地异步模型的价值在于可观察和可恢复。

Alternatives considered:

- 只提供内部 API 不提供 CLI：拒绝，CLI-first 产品需要用户能直接操作任务。

## Risks / Trade-offs

- [Risk] 同一业务对象被多个 task 并发执行 → Mitigation: 首版 runner 单任务执行；task run 检查 active task status，并依赖 workflow gates 拒绝不合法状态。
- [Risk] retry 重复写 artifacts → Mitigation: workflow 必须保持幂等或通过当前业务状态拒绝；task 只记录 attempt。
- [Risk] LLM 失败被误判为不可重试 → Mitigation: 明确错误分类，agent/storage transient error 可 retry，INVALID_STATE/schema gate 不 retry。
- [Risk] task JSON 中泄露大文本或 secrets → Mitigation: payload 只保存 ids/options；禁止 credentials/raw content。
- [Risk] 用户误以为 task 会自动后台执行 → Mitigation: CLI 文案明确需要 `task run`，不提供 daemon。

## Migration Plan

1. 增加 domain schema 和状态机：`LocalTask`, `TaskAttempt`, `RetryPolicy`, `TaskStatus`, `TaskType`。
2. 增加 storage layout：`knowledge/tasks/YYYY/MM/task_xxx.json` 和 path/repo helpers。
3. 增加 task workflows：enqueue、run、retry、list、show。
4. 在 runner 中接入受控 task types，并调用现有 workflow。
5. 增加 CLI `task` 命令组。
6. 增加测试：domain state transitions、storage paths、retry policy、runner gate、CLI JSON。
7. 验证：OpenSpec validate、typecheck、Vitest、ESLint、Prettier check、build。

Rollback: 不使用 task CLI 时，现有同步命令保持不变。task 文件是独立派生工作记录，可安全忽略或归档，不影响 Source / Note truth。

## Open Questions

- task id 格式建议 `task_YYYYMMDD_<slug>`，是否需要包含 task type 缩写可在实现时固定。
- 首版是否支持 `task run --all`，建议先支持单次 run next，避免长时间不可控循环。
- retry delay 首版是否只记录 `next_run_after` 而不自动调度，建议是；自动调度另开变更。
