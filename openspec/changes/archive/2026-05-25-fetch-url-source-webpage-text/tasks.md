## 1. Domain / Storage Baseline

- [x] 1.1 确认 `Source` schema 支持 `ingest_type = input_url`、`content_type = link`、`origin.user_input_type = url`、非空 `url` 和标准 `processing_artifacts` 三件套。
- [x] 1.2 确认 storage path helpers 固定支持 URL raw snapshot `raw/fetched.html`，且 processed artifacts 只返回相对 Source 目录路径。

## 2. URL Ingest Workflow

- [x] 2.1 确认或完善 `ingest_url_workflow` 只接受 absolute public HTTP(S) URL，并拒绝 localhost/private/internal network 范围。
- [x] 2.2 确认或完善 URL fetch 逻辑：follow redirect 后仍必须是 public URL、响应必须 ok、content-type 必须是 HTML、HTML 不得为空。
- [x] 2.3 确认 URL ingest 成功时创建 `status = ingested` 的 Source，保存 `raw/fetched.html`，初始化空 `processing_artifacts` 并返回 process next action。
- [x] 2.4 确认 URL ingest 失败时不创建 `Source`、`Note` 或 `Index Entry`。

## 3. URL Processing

- [x] 3.1 确认或完善 `process_source_workflow` 对 `ingest_type = input_url` 的分发逻辑，只读取 `raw/fetched.html`，不重新 fetch 远端页面。
- [x] 3.2 确认或完善 `process_url_html` 的正文提取，移除 script/style/noscript/svg，保留标题、heading、段落、列表和链接。
- [x] 3.3 确认相对链接解析为绝对链接，metadata 包含 title、links、segment_count、processed_at 和 `source_url`。
- [x] 3.4 确认 URL processing 成功写入 `processed/clean_text.md`、`processed/segments.json`、`processed/metadata.json` 并登记三件套路径。
- [x] 3.5 确认 URL processing 失败时 Source 尽可能转为 `failed`，写入 `last_error.stage = processing`，且不创建正式 `Note` 或主索引。

## 4. CLI Integration

- [x] 4.1 确认 `ai-knowledge source ingest url <public_url>` 人类可读输出包含 Source 摘要和下一步 process 命令。
- [x] 4.2 确认 `ai-knowledge source ingest url <public_url> --json` 输出 created Source id、URL Source 摘要和下一步 process 命令。
- [x] 4.3 确认 `ai-knowledge source process <source_id>` 与 `--json` 对 URL Source 返回 processed 摘要和下一步 `ai-knowledge source understand <source_id>`。

## 5. Tests

- [x] 5.1 增加或补齐 URL ingest workflow 测试，覆盖成功抓取 public HTML 并保存 `raw/fetched.html`。
- [x] 5.2 增加或补齐 URL ingest workflow 测试，覆盖 invalid URL、private/internal URL、fetch failure、非 HTML、空 HTML 均不创建 Source。
- [x] 5.3 增加或补齐 URL processor 单元测试，覆盖正文提取、heading/list/link 保留、相对链接转绝对链接、metadata `source_url`。
- [x] 5.4 增加或补齐 URL processing workflow 测试，覆盖成功生成标准三件套且 processing 阶段不重新 fetch。
- [x] 5.5 增加或补齐 URL processing workflow 测试，覆盖 `raw/fetched.html` 缺失时进入 `failed` 且不创建 Note/Index。
- [x] 5.6 增加或补齐 CLI 测试，覆盖 URL ingest/process 的 human-readable 与 JSON 输出。
- [x] 5.7 增加或补齐后续理解边界测试，确认 processed URL artifacts 可被 `understand_source_workflow` 消费，且不依赖远端网页。

## 6. Verification

- [x] 6.1 运行 `openspec status --change fetch-url-source-webpage-text` 并确认 artifacts apply-ready。
- [x] 6.2 运行 `openspec validate fetch-url-source-webpage-text --strict`。
- [x] 6.3 运行 `pnpm typecheck`。
- [x] 6.4 运行 `pnpm test`。
- [x] 6.5 运行 `pnpm lint` 和 `pnpm format:check`。
- [x] 6.6 运行 `pnpm build`。
