## 1. Domain and Validation

- [x] 1.1 确认 Source state machine 支持 `discussing -> approved_for_note`。
- [x] 1.2 确认 Source invariant 要求 `approved_for_note` 必须 `ready_for_approval = true` 且 `confirmed_points` 非空。
- [x] 1.3 添加或补充 domain tests，覆盖不满足 ready/confirmed 条件时不能构造 approved_for_note Source。

## 2. Workflow

- [x] 2.1 实现 `approve_source_workflow`，加载 Source 并校验当前状态必须为 `discussing`。
- [x] 2.2 校验 `discussion_summary.ready_for_approval = true`。
- [x] 2.3 校验 `discussion_summary.confirmed_points` 非空。
- [x] 2.4 成功路径设置 `discussion_summary.discussion_status = closed`。
- [x] 2.5 成功路径通过状态机执行 `discussing -> approved_for_note`，保存 Source。
- [x] 2.6 成功路径返回 next action `ai-knowledge note compose <source_id>`。
- [x] 2.7 不实现任何 force approve 参数或绕过逻辑。
- [x] 2.8 添加 workflow tests，覆盖成功、非 discussing 状态、not ready、confirmed_points 为空和 next action。

## 3. CLI

- [x] 3.1 新增 `ai-knowledge source approve <source_id>` 命令。
- [x] 3.2 人类可读输出展示 Source id、status、discussion status 和 next action。
- [x] 3.3 支持 `--json` 输出 workflow result。
- [x] 3.4 不提供 `--force` 选项。
- [x] 3.5 添加 CLI tests，覆盖成功输出、`--json` 输出、状态不匹配错误和 not ready 错误。

## 4. Verification

- [x] 4.1 运行 OpenSpec 校验，确认 `approve-source-discussion` change 有效。
- [x] 4.2 运行 TypeScript typecheck。
- [x] 4.3 运行 Vitest 测试套件。
- [x] 4.4 运行 ESLint 和 Prettier 检查。
- [x] 4.5 运行 build。
- [x] 4.6 使用 fixture 跑通 `ingest -> process -> understand -> discuss ready -> approve`，确认 Source 进入 `approved_for_note` 且 discussion_status 为 `closed`。
