## 1. 验收 fixture 与测试 helper

- [x] 1.1 准备稳定 PDF 验收 fixture 或 deterministic PDF processor fixture，确保可产生可处理文本与 PDF locator metadata。
- [x] 1.2 准备 deterministic URL HTML/content-type fixture，覆盖 successful public page、fetch failure 与 unsupported content-type。
- [x] 1.3 抽取端到端验收测试 helper，复用 ingest/process/understand/discuss/approve/compose/lint/index/answer 主链路，但不新增生产抽象。

## 2. P1 happy path 自动化验收

- [x] 2.1 新增 PDF happy path 端到端验收，从空 `knowledge/` 跑到 approved Note、index entry 与 answer。
- [x] 2.2 在 PDF 验收中断言 `processed/clean_text.md`、`processed/segments.json`、`processed/metadata.json` 与 PDF locator metadata 存在。
- [x] 2.3 新增 URL happy path 端到端验收，从空 `knowledge/` 跑到 approved Note、index entry 与 answer。
- [x] 2.4 在 URL 验收中断言 frozen snapshot、processed artifacts 与 URL locator metadata 存在。
- [x] 2.5 在 PDF/URL happy path 中断言 answer 只接收并引用 approved Notes，不读取 raw material、draft understanding 或 discussion summary。

## 3. P1 失败路径与 gate 验收

- [x] 3.1 新增 URL fetch failure 验收，确认 workflow/CLI 返回明确错误且状态不被错误推进。
- [x] 3.2 新增 unsupported URL content-type 验收，确认错误信息明确且不会写入可处理 Source。
- [x] 3.3 新增 PDF extraction failure 验收，确认错误信息明确且 raw PDF 保留。
- [x] 3.4 新增或复用 gate 验收，确认 PDF/URL Source 在 discussion approval 前不能 `note compose`。
- [x] 3.5 新增或复用 gate 验收，确认 PDF/URL draft Note 在 `note lint` 通过前不能 `note approve`。

## 4. 人工 CLI 验收文档

- [x] 4.1 新增或扩展 P1 manual acceptance 文档，列出 PDF 与 URL 的 CLI 命令链路。
- [x] 4.2 在人工验收文档中列出 processed artifacts、source refs、evidence locator、approved Note、index entry 与 answer 的检查点。
- [x] 4.3 在人工验收文档中列出 URL fetch failure、unsupported content-type、PDF extraction failure 的检查方式与通过标准。
- [x] 4.4 明确默认自动化验收不依赖真实 LLM 或真实公网；如包含真实 LLM smoke，则标明本地显式触发、凭证要求、成本与波动边界。

## 5. 验证

- [x] 5.1 运行 OpenSpec validation，确认 `p1-end-to-end-acceptance-pdf-url` 的 proposal、design、specs、tasks 均有效。
- [x] 5.2 运行 targeted Vitest 验收测试与相关 PDF/URL workflow/CLI 测试。
- [x] 5.3 运行完整 `pnpm test`，修复失败用例。
- [x] 5.4 运行 `pnpm typecheck`，修复类型错误。
- [x] 5.5 运行 `pnpm lint` 与 `pnpm format:check`，修复质量问题。
- [x] 5.6 运行 `pnpm build`，确认 CLI 可构建。
