## 1. Domain Checker

- [x] 1.1 新增 deterministic discussion convergence checker，输入 `Source`，输出 passed 与 failure reasons，不读写文件、不调用 Agent。
- [x] 1.2 定义 checker failure reason 类型，覆盖非 `discussing` 状态、`ready_for_approval = false`、缺少 `confirmed_points`、存在 `open_questions`、存在 `unresolved_issues`。
- [x] 1.3 增加 domain tests，覆盖 checker passed 与各类失败 reason。

## 2. Workflow Integration

- [x] 2.1 在 `discuss_source_workflow` 应用 Agent summary update 后运行 checker，不通过时将持久化的 `ready_for_approval` 规范化为 `false`。
- [x] 2.2 在 `approve_source_workflow` 中使用 checker 作为 approval gate，通过时才允许 `discussing -> approved_for_note`。
- [x] 2.3 更新 workflow error message/details，确保 approval 被 checker 拒绝时返回可读 failure reasons。
- [x] 2.4 增加 workflow tests，覆盖 discussion readiness normalization、approval accepted、approval rejected with reasons。

## 3. CLI Integration

- [x] 3.1 更新 `source approve` CLI 错误输出或 JSON 输出，包含 convergence failure reasons。
- [x] 3.2 增加 CLI tests，覆盖未收敛 approval 的 human-readable 和 JSON 错误输出。

## 4. Verification

- [x] 4.1 运行 `openspec validate discussion-convergence-rule-checker --strict`。
- [x] 4.2 运行 focused Vitest tests 覆盖 domain、workflow、CLI convergence checker 行为。
- [x] 4.3 运行 `pnpm typecheck`、`pnpm lint`、`pnpm format:check`、`pnpm build` 和 `pnpm test`。
