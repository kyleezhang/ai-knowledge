## 1. Domain Contracts

- [x] 1.1 新增 `LocalTask`、`TaskAttempt`、`RetryPolicy`、`TaskError`、`TaskPayload` 类型，字段保持 snake_case。
- [x] 1.2 新增 Zod schema 校验 task id、task type、status、payload、retry policy、attempts、timestamps、result_ref。
- [x] 1.3 新增 task state-machine helpers，控制 `pending`、`running`、`succeeded`、`retryable_failed`、`failed`、`cancelled` 转换。
- [x] 1.4 新增 retry classification helper，区分 retryable provider/storage failures 与 non-retryable invalid state/schema gate failures。
- [x] 1.5 增加 domain 测试覆盖 schema、状态转换、非法 payload、attempt 递增、retry policy、max attempts。

## 2. Storage Layer

- [x] 2.1 新增 `knowledge/tasks/` storage path helpers，按 task id 日期生成 task JSON 路径。
- [x] 2.2 新增 task repository，支持 create/get/save/list，并在读写时使用 Zod 校验。
- [x] 2.3 扩展 storage initialization，创建 `knowledge/tasks/` 目录。
- [x] 2.4 增加 storage 测试覆盖路径生成、读写、list 排序、非法 JSON 拒绝、init 目录。

## 3. Task Workflows

- [x] 3.1 新增 enqueue task workflow，验证 task type / payload 并写入 pending task。
- [x] 3.2 新增 run task workflow，加载 pending / retryable_failed task，创建 attempt 并调用 runner。
- [x] 3.3 新增 retry task workflow，只允许 retryable_failed task 创建新 attempt。
- [x] 3.4 新增 list/show task workflows，返回 task summary、attempt history、next action。
- [x] 3.5 增加 workflow 测试覆盖 enqueue、run success、retryable failure、non-retryable failure、retry rejection。

## 4. Runner Integration

- [x] 4.1 实现受控 runner dispatch，支持 `source.process` 调用 `process_source_workflow`。
- [x] 4.2 实现 `source.understand` task 调用 `understand_source_workflow`，保持 processed artifact gate 和 LLM schema gate。
- [x] 4.3 实现 `note.index` task 调用 `index_note_workflow`，保持 approved-only gate。
- [x] 4.4 实现 `note.vector_index` task 调用带 vector 选项的 `index_note_workflow`，失败不写 invalid `vector_ref`。
- [x] 4.5 确保 runner 不直接写 Source / Note / Index business state，只更新 task JSON。
- [x] 4.6 增加 runner 测试覆盖 workflow 调用、业务状态 gate、attempt error 分类、幂等重跑。

## 5. CLI Integration

- [x] 5.1 新增 `ai-knowledge task enqueue` 命令，支持受控 task type 和 payload 参数。
- [x] 5.2 新增 `ai-knowledge task run [task_id]` 命令，未传 id 时运行一个 eligible task。
- [x] 5.3 新增 `ai-knowledge task retry <task_id>` 命令，拒绝非 retryable_failed task。
- [x] 5.4 新增 `ai-knowledge task list` / `task show <task_id>` 命令。
- [x] 5.5 所有 task CLI 命令支持 `--json`，非 JSON 输出展示 status、attempts、error、next action。
- [x] 5.6 增加 CLI 测试覆盖 enqueue/run/retry/list/show、JSON 输出、错误输出。

## 6. Spec And Compatibility

- [x] 6.1 确认 source-processing、draft-understanding、note-indexing、vector-indexing delta 与 `local-task-runtime` 新能力一致。
- [x] 6.2 保持现有 P0 同步命令默认行为不变；如 CLI 命令名或 task type 调整，同步更新本 change artifacts。

## 7. Verification

- [x] 7.1 运行 `openspec status --change "local-async-task-and-retry-model"` 确认 artifacts apply-ready。
- [x] 7.2 运行 OpenSpec validation，确保 `local-task-runtime` 与相关 delta specs 可归档。
- [x] 7.3 运行 TypeScript typecheck。
- [x] 7.4 运行 Vitest 测试。
- [x] 7.5 运行 ESLint / Prettier 检查。
- [x] 7.6 运行 build，确认 CLI 产物可生成。