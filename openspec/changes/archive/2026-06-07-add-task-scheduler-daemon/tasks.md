## 1. Domain 与调度契约

- [x] 1.1 梳理现有 `LocalTask` schema、status state machine、retry policy 和 task runner 入口，确认 daemon 需要复用或扩展的字段。
- [x] 1.2 增加 task claim/lease 所需的 domain 类型和 Zod 校验，保持旧 task JSON 可兼容读取。
- [x] 1.3 增加 task eligibility helper，判断 `pending` 与到期 `retryable_failed` 是否可被 daemon 执行。
- [x] 1.4 为 claim/lease、retry due、ineligible status 增加 domain 单元测试。

## 2. Storage 原子领取

- [x] 2.1 在 task storage helper 中实现原子 claim/lease 写入，不在 workflow 或 CLI 中手拼 `knowledge/` 路径。
- [x] 2.2 实现 claim 冲突处理，确保多个 runner 同时领取同一 task 时最多一个成功。
- [x] 2.3 实现 stale claim/lease 的检测和回收规则。
- [x] 2.4 为 task claim、claim conflict、stale lease、旧 task 兼容读取增加 storage 测试。

## 3. Workflow / Daemon 调度循环

- [x] 3.1 新增 task daemon workflow/service，按顺序扫描 eligible tasks 并复用现有 task runner 执行业务 workflow。
- [x] 3.2 支持 bounded run 参数：最大执行数、空闲退出轮数、轮询间隔、lease timeout。
- [x] 3.3 支持 graceful stop：停止领取新任务，并在当前 task runner 结果落盘后退出。
- [x] 3.4 确保 daemon 不直接修改 Source、Note、Index Entry、Vector Index 或 Candidate，只通过现有 workflows 推进。
- [x] 3.5 为 pending task 执行、retryable_failed 到期执行、未到期跳过、ineligible status 跳过、workflow gate failure 增加 workflow 测试。

## 4. CLI 接入

- [x] 4.1 增加 `ai-knowledge task daemon` CLI 命令，接入 daemon workflow/service。
- [x] 4.2 增加 CLI 参数解析：`--max-runs`、`--idle-exit-after`、`--poll-interval-ms`、`--lease-timeout-ms`、`--json`。
- [x] 4.3 实现 human-readable 输出，展示 task id、type、attempt/status、idle 状态和 daemon 退出原因。
- [x] 4.4 实现 `--json` 输出 daemon session summary。
- [x] 4.5 为 daemon CLI 的 bounded run、空队列、JSON 输出和失败任务输出增加 CLI 测试。

## 5. 回归与验证

- [x] 5.1 增加端到端测试：enqueue 多个 task 后由 daemon 连续推进，并验证 task attempt history 与业务对象状态。
- [x] 5.2 增加并发领取测试，验证 daemon 与手动 `task run` 不会重复执行同一 task。
- [x] 5.3 运行 `openspec status --change "add-task-scheduler-daemon"` 确认 artifacts 与 apply readiness。
- [x] 5.4 运行 `pnpm typecheck`。
- [x] 5.5 运行 `pnpm test`。
- [x] 5.6 运行 `pnpm lint`。
- [x] 5.7 运行 `pnpm format:check`。
- [x] 5.8 运行 `pnpm build`。
