## 1. Domain 与 storage 契约扩展

- [x] 1.1 扩展 `Source` schema、enum 与 validator，支持 `upload_pdf`、`input_url`、`origin.user_input_type = pdf|url`，并补充 URL 必填 / 本地文件 `url = null` 等约束。
- [x] 1.2 扩展 storage path 与 artifact helper，统一管理 `raw/original.pdf`、`raw/fetched.html` 以及通用 `processed/*` 路径，避免在 workflow 中手拼 `knowledge/` 路径。

## 2. Ingest 与 processing 实现

- [x] 2.1 实现 `ai-knowledge source ingest pdf <file>` workflow，复制 `raw/original.pdf`、创建 `ingested` Source，并保持 `discussion.jsonl` / `processed/` 初始化契约一致。
- [x] 2.2 实现 `ai-knowledge source ingest url <public_url>` workflow，在 ingest 阶段抓取公开页面快照、落盘 `raw/fetched.html`，并拒绝需要鉴权或超出显式单页抓取范围的输入。
- [x] 2.3 扩展 processing，使 Markdown、PDF、URL 都输出 `processed/clean_text.md`、`processed/segments.json`、`processed/metadata.json`，并通过 state machine 维持 `ingested -> processing -> processed` 与 `last_error` 语义。
- [x] 2.4 保持 understand / discuss / note 下游只消费标准化 processed artifacts，不直接读取 PDF 二进制或 raw HTML。

## 3. CLI 与用户可见行为

- [x] 3.1 为 CLI 增加 `ai-knowledge source ingest pdf <file>` 与 `ai-knowledge source ingest url <public_url>`，并保持非交互命令的 `--json` 与 `next_actions` 契约一致。
- [x] 3.2 更新相关 Source 展示与错误提示，确保 URL 导入失败不会产生半成品主对象，且新的 ingest_type / content_type 能被稳定展示。

## 4. 测试与验证

- [x] 4.1 新增 domain / storage 测试，覆盖新 enum、validator、raw layout 与 path safety。
- [x] 4.2 新增 workflow / CLI 测试，覆盖 PDF ingest、URL ingest、public URL rejection、processing normalization 与 next action。
- [x] 4.3 新增 understand 边界测试，确认 PDF / URL 仍通过 normalized artifacts 生成 `draft_understanding`，且测试不依赖真实 LLM。
- [x] 4.4 运行 OpenSpec validation、typecheck、Vitest、lint / format check 与 build，确认 P1 输入契约扩展可进入实现阶段。
