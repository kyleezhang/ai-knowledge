## 1. Domain

- [x] 1.1 新增 `LocalSchedule` domain schema、TypeScript type、status/type/rule/policy 枚举，并保持字段使用 snake_case
- [x] 1.2 实现 schedule id 生成、unsafe payload 校验、next_run_at 计算 helper，覆盖 `interval_minutes` 与 `daily_time`
- [x] 1.3 为 schedule domain 增加 Vitest 单元测试，覆盖 schema 校验、非法凭证字段拒绝、next_run_at 计算和 disabled 状态

## 2. Storage

- [x] 2.1 在 storage path helpers 中新增 `knowledge/schedules/` 目录解析与 schedule 文件路径生成
- [x] 2.2 实现 schedule repo，支持 create/save/get/list，并在读写时执行 Zod validation
- [x] 2.3 更新 init workflow，使新工作区创建 schedules 目录，并保证旧工作区首次写 schedule 时可懒创建
- [x] 2.4 增加 storage 测试，覆盖路径生成、旧工作区懒创建、list 排序和无效 JSON 读取失败

## 3. LocalTask integration

- [x] 3.1 扩展 LocalTask payload 类型，支持 scheduler 需要的 `source.process`、`source.understand`、`note.render`、`note.lint`、`note.index` 安全 payload
- [x] 3.2 实现 scheduler task dedupe key 生成与未终态 task 查重 helper
- [x] 3.3 确认 task runner 对 scheduler-created tasks 仍复用现有 workflow path，不直接修改 Source/Note/Index 状态
- [x] 3.4 增加 task runtime 测试，覆盖 scheduler-created task 被 daemon 正常 claim/run/retry，以及 draft note index 被 workflow gate 拒绝

## 4. Scheduler workflows

- [x] 4.1 实现 schedule create/list/show/enable/disable workflows，并返回统一 `WorkflowResult`
- [x] 4.2 实现 scheduler tick workflow：扫描 due enabled schedules、执行动作、更新 last_run_at/next_run_at/summary
- [x] 4.3 实现 scheduled collection action，调用现有 `collect_candidates_workflow`，并验证只创建 Candidate
- [x] 4.4 实现 auto advancement planner，扫描 Candidate/Source/Note/Index 状态，只为 allowlist 安全步骤创建 LocalTask
- [x] 4.5 实现 auto advancement human-gate guard，显式跳过 `candidate.select`、`source.approve`、`note.compose`、`note.approve`
- [x] 4.6 增加 workflow 测试，覆盖 due/not due/disabled schedule、collector failure summary、duplicate task skip、human confirmation gates

## 5. CLI

- [x] 5.1 新增 `ai-knowledge schedule` 命令组，支持 list/show/create/enable/disable/tick，并全部支持 `--json`
- [x] 5.2 为 collection schedule create 提供 provider 与 rule 参数，并输出 schedule id、status、next_run_at
- [x] 5.3 为 auto advancement schedule create 提供安全默认策略，CLI 文案明确不会自动选择候选或自动审批
- [x] 5.4 增加 CLI 测试，覆盖 schedule 创建、禁用、tick 输出、JSON 输出和非法参数错误

## 6. Verification

- [x] 6.1 运行 OpenSpec status/validate，确认 proposal、design、specs、tasks 均满足 schema
- [x] 6.2 运行 `pnpm typecheck`
- [x] 6.3 运行 `pnpm test`
- [x] 6.4 运行 `pnpm lint`
- [x] 6.5 运行 `pnpm format:check`
- [x] 6.6 运行 `pnpm build`
