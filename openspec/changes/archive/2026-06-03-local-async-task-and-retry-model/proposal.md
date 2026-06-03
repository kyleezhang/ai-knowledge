## Why

随着处理、理解、索引、embedding、hybrid retrieval 等能力增加，部分工作会变成长耗时或易受外部模型 / 文件 IO 失败影响的流程；当前 CLI 同步执行模型缺少统一的任务状态、失败记录和可控重试。需要一个本地异步任务与重试模型，让长耗时工作可以被排队、观察、重试，并且不破坏 Source / Note / Index 的状态机和知识边界。

本变更属于 **P3 scope**：新增本地 filesystem-backed async task 契约和 retry 语义；不引入外部队列、数据库、后台常驻服务或 Web UI。

## What Changes

- 新增本地异步任务能力：定义 `LocalTask` 对象、状态枚举、attempt 记录、错误记录、payload 引用和结果引用。
- 新增 retry 模型：支持可重试失败、不可重试失败、最大重试次数、attempt 间隔和幂等性约束。
- 定义任务 runner 边界：runner 只能调用现有 workflow，不能绕过 domain state-machine helpers，也不能直接修改 Source / Note / Index 状态。
- 扩展 storage layout：在 `knowledge/tasks/` 下保存任务 JSON 和 attempt 记录，所有路径通过 storage helpers 生成。
- 扩展 CLI：提供 task enqueue / run / retry / show / list 的本地命令，用于观察和手动驱动任务执行。
- 定义适用任务类型：source processing、draft understanding、note indexing、vector indexing 等可作为任务 payload；P0 同步命令默认行为不变。
- Non-goals：不新增 PDF、auto-collection、Web UI、数据库、外部 queue / worker 服务、分布式锁；不改变 approved-only gate 或 formal Note 生成规则。

## Capabilities

### New Capabilities
- `local-task-runtime`: 定义本地异步任务对象、状态、attempt、retry、runner 与 CLI 操作契约。

### Modified Capabilities
- `source-processing`: 允许 Source processing 通过 local task 异步执行，但必须保持现有 processing gate 和状态语义。
- `draft-understanding`: 允许 draft understanding 通过 local task 异步执行，但必须保持 processed artifact gate 和 LLM schema validation gate。
- `note-indexing`: 允许 note indexing / vector indexing 通过 local task 异步执行，但必须保持 approved-only indexing gate。
- `vector-indexing`: 允许 vector index build / rebuild 通过 local task 重试，但失败不得产生 main-retrievable vector entry。

## Impact

- Affected layers: domain, storage, workflows, agents, CLI, tests。
- Domain: 新增 task 类型、状态机、retry policy、attempt/error schema 和校验。
- Storage: 新增 `knowledge/tasks/` 路径 helper 与 JSON repository；读写必须通过 Zod 校验。
- Workflows: 增加 task enqueue / run / retry workflow；runner 组合现有 workflows，不直接写业务对象状态。
- Agents: 不新增 agent 写文件权限；agent failures 由 workflow 捕获为 task attempt error。
- CLI: 新增 `ai-knowledge task ...` 命令组；现有 P0 命令默认同步行为不变。
- Tests: 覆盖状态转换、retry policy、路径生成、attempt 记录、workflow gates、不可重试失败、幂等重跑。