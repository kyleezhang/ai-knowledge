## 1. Domain / Storage Baseline

- [x] 1.1 确认 `Source` schema、`ingest_type = upload_pdf`、`origin.user_input_type = pdf`、`processing_artifacts` 三件套和 `last_error.stage = processing` 校验满足本变更需求。
- [x] 1.2 确认 storage path helpers 固定支持 `raw/original.pdf`，且 artifact 读写只返回相对 Source 目录路径。

## 2. PDF Processing

- [x] 2.1 确认或完善 `src/processing/pdf-processor.ts`，使其从 `Uint8Array` PDF 输入生成 `DocumentProcessingResult`。
- [x] 2.2 确保 PDF 输出包含归一化正文、page-aware 或 section-aware segments，以及包含 `page_count`（可得时）的 metadata。
- [x] 2.3 确保 PDF 处理失败不会改写或删除 `raw/original.pdf`，也不会生成可被误认为成功的空 artifacts。

## 3. Workflow / CLI Integration

- [x] 3.1 确认或完善 `process_source_workflow` 对 `ingest_type = upload_pdf` 的分发逻辑，读取 `raw/original.pdf` 并调用 PDF processor。
- [x] 3.2 确认成功路径使用 `ingested -> processing -> processed`，写入 `processed/clean_text.md`、`processed/segments.json`、`processed/metadata.json` 并登记三件套路径。
- [x] 3.3 确认失败路径将 Source 尽可能转为 `failed`，写入 `last_error.stage = processing`，并保持 Note 和 Index 状态不变。
- [x] 3.4 确认 `ai-knowledge source process <source_id>` 和 `--json` 输出对 PDF Source 返回 processed 摘要与下一步 `ai-knowledge source understand <source_id>`。

## 4. Tests

- [x] 4.1 增加或补齐 PDF processor 单元测试，覆盖页级文本、metadata、空文本或解析异常。
- [x] 4.2 增加或补齐 workflow 测试，覆盖 PDF Source 成功处理并生成标准三件套路径。
- [x] 4.3 增加或补齐 workflow 测试，覆盖 `raw/original.pdf` 缺失时 Source 进入 `failed` 且 `last_error.stage = processing`。
- [x] 4.4 增加或补齐 workflow 测试，覆盖 PDF processor 抛错时 raw PDF 保留且不会生成正式 Note 或 Index。
- [x] 4.5 增加或补齐后续理解边界测试，确认 processed PDF artifacts 可被 `understand_source_workflow` 消费，且不依赖 raw PDF。

## 5. Verification

- [x] 5.1 运行 `openspec status --change process-pdf-source-artifacts` 并确认 artifacts apply-ready。
- [x] 5.2 运行项目可用的 OpenSpec 校验命令（如 `openspec validate process-pdf-source-artifacts --strict`）。
- [x] 5.3 运行 `pnpm typecheck`。
- [x] 5.4 运行 `pnpm test`。
- [x] 5.5 运行 `pnpm lint` 和 `pnpm format:check`。
- [x] 5.6 运行 `pnpm build`。
