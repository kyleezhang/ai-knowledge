## 1. Smoke flow 数据结构与编排

- [x] 1.1 扩展 `SmokeRunResult`，支持 Markdown/PDF/URL 多路径结果汇总，并保留 skipped/passed 语义。
- [x] 1.2 在 `src/smoke/local-llm-smoke.ts` 中抽取内部 flow helper，统一执行 ingest/process/understand/discuss/compose/lint/approve/index/answer 链路。
- [x] 1.3 在 flow helper 的错误信息中包含 path label、workdir、source_id、note_id 与 stderr/stdout 摘要。
- [x] 1.4 保留 `--keep-workdir` 行为，确保失败或成功时可定位临时目录。

## 2. Markdown/PDF/URL 真实 LLM smoke 覆盖

- [x] 2.1 将现有 Markdown smoke 改造成统一 flow 的 `markdown` path，并继续使用真实 LLM agent。
- [x] 2.2 添加 PDF smoke path，使用稳定 PDF fixture 或 deterministic PDF processing input，通过真实 LLM 跑完 Note 与 answer 链路。
- [x] 2.3 在 PDF smoke path 中验证标准 processed artifacts、PDF locator metadata、approved Note、index entry 与 answer grounding。
- [x] 2.4 添加 URL smoke path，使用 deterministic HTML / fetch fixture，通过真实 LLM 跑完 Note 与 answer 链路。
- [x] 2.5 在 URL smoke path 中验证 frozen snapshot、标准 processed artifacts、URL locator metadata、approved Note、index entry 与 answer grounding。
- [x] 2.6 确认 smoke 中 understand、discuss、note compose、answer 均使用真实 LLM agent，不注入 fake agent output。

## 3. CLI 输出与文档

- [x] 3.1 更新 `scripts/local-llm-smoke.mjs` 输出，展示每条 path 的 source_id、note_id 与 answer_conclusion/summary。
- [x] 3.2 保持缺少 `DEEPSEEK_API_KEY` 时明确 skipped，不输出 passed。
- [x] 3.3 更新 P0/P1 manual acceptance 或 README 类说明，明确 `pnpm test:smoke` 是唯一真实 LLM smoke 入口。
- [x] 3.4 在文档中说明默认 `pnpm test` 仍使用 fake agents，真实 smoke 仅本地显式触发且会消耗 token。

## 4. Tests

- [x] 4.1 更新 smoke 单元测试，覆盖缺少 provider key 时 skipped。
- [x] 4.2 更新 smoke 单元测试，覆盖多路径 result shape 与 CLI 输出格式。
- [x] 4.3 增加或更新测试，确保统一 smoke 编排包含 Markdown、PDF、URL path labels。
- [x] 4.4 增加或更新测试，确保错误信息包含失败 path label 与可用调试信息。

## 5. 验证

- [x] 5.1 运行 OpenSpec validation，确认 `unify-real-llm-smoke-p0-p1` 的 proposal、design、specs、tasks 均有效。
- [x] 5.2 运行 targeted smoke tests，确认不调用真实 provider 的单元测试通过。
- [x] 5.3 运行完整 `pnpm test`。
- [x] 5.4 运行 `pnpm typecheck`。
- [x] 5.5 运行 `pnpm lint` 与 `pnpm format:check`。
- [x] 5.6 运行 `pnpm build`。
- [x] 5.7 如本地配置 `DEEPSEEK_API_KEY`，显式运行 `pnpm test:smoke -- --keep-workdir` 并记录结果；如未配置，记录 skipped 行为。
