## 1. Domain

- [x] 1.1 确认或补齐 `Source` schema/type 覆盖 `upload_markdown`、`document`、`user_import`、空 `processing_artifacts`、`draft_understanding = null`、`summary_version = 0` 和 `note_ids = []`
- [x] 1.2 确认或补齐 Source validator，确保 `origin.type = user_import` 时 `origin_candidate_id = null`，且 `ingested` 状态不要求 processed artifacts 或 draft_understanding
- [x] 1.3 确认或补齐 ID、slug、UTC 时间和本地年月 helpers，导入 Markdown 时可生成稳定 `src_{date}_upload_markdown_{slug}`
- [x] 1.4 确认 Source state-machine 不允许 `ingested -> understanding_ready`，并保持导入流程只创建初始 `ingested` Source

## 2. Storage

- [x] 2.1 补齐 Source path helpers，通过 Source id 解析 `knowledge/sources/YYYY/MM/<source_id>/`，不在业务层手写 `knowledge/` 路径
- [x] 2.2 补齐 JSON store/repo 写入逻辑，写入前后使用 Zod parse，并保持 2 spaces + trailing newline
- [x] 2.3 实现 Source 创建：创建 Source 目录、`raw/`、`processed/`、空 `discussion.jsonl`、`source.json`
- [x] 2.4 实现 raw Markdown 保存为 `raw/original.md`，保留原始文件内容且防止 path traversal
- [x] 2.5 实现 `get_source` 和 `list_sources`，list 默认按 `updated_at desc`，支持 `status` filter
- [x] 2.6 实现缺失 Source 的 storage error 映射，供 show workflow 返回 `NOT_FOUND`

## 3. Workflows

- [x] 3.1 实现 `ingest_markdown_workflow` 输入校验：文件存在、可读、Markdown 输入有效，失败时不创建半成品 Source
- [x] 3.2 实现 Markdown title 提取与 slug 生成，按现有约定优先使用 frontmatter title、H1 或文件名
- [x] 3.3 在导入 workflow 中构造初始 Source，设置 `status = ingested`、`ingest_type = upload_markdown`、`content_type = document`、`origin.type = user_import`
- [x] 3.4 在导入 workflow 中调用 Source repo 保存 Source 和 raw file，并返回 `source_id`、Source 摘要和 `next_actions`
- [x] 3.5 实现 `list_sources_workflow`，只读返回 Source 队列并支持状态过滤
- [x] 3.6 实现 `show_source_workflow`，只读返回 Source 控制面摘要，缺失时返回 workflow `NOT_FOUND`
- [x] 3.7 确保导入、list、show workflows 不生成 processed artifacts、draft_understanding、Note 或 Index Entry

## 4. CLI

- [x] 4.1 接入 `ai-knowledge source ingest markdown <file>`，CLI 只解析参数并调用 `ingest_markdown_workflow`
- [x] 4.2 接入 `ai-knowledge source list` 和 `ai-knowledge source list --status <status>`，CLI 只调用 `list_sources_workflow`
- [x] 4.3 接入 `ai-knowledge source show <source_id>`，CLI 只调用 `show_source_workflow`
- [x] 4.4 为上述非交互命令接入 `--json`，输出 workflow result data 的 JSON
- [x] 4.5 为人类可读输出展示必要字段和 workflow `next_actions`，不默认输出完整 raw 或 processed artifact 正文
- [x] 4.6 为错误输出保持统一结构，覆盖 invalid input、not found、validation failure 和 storage failure

## 5. Tests

- [x] 5.1 添加 domain tests：Source 初始对象 schema、user_import validator、Source state-machine 禁止跳过 processing
- [x] 5.2 添加 storage tests：Source 目录布局、`raw/original.md` 内容保留、空 `discussion.jsonl`、`processed/` 目录、list 排序和 status filter
- [x] 5.3 添加 workflow tests：Markdown 导入成功、next action 返回、无效文件失败且不创建 Source、list/show 只读、missing Source 返回 `NOT_FOUND`
- [x] 5.4 添加 CLI tests：`source ingest markdown`、`source list`、`source show` 的人类可读输出与 `--json` 输出
- [x] 5.5 添加回归测试，确认导入 Source 不创建 `draft_understanding`、Note、Index Entry 或 processed artifacts

## 6. Verification

- [x] 6.1 运行 OpenSpec validation，确认 `import-markdown-source-view` change 通过校验
- [x] 6.2 运行 `pnpm typecheck`
- [x] 6.3 运行 `pnpm test`
- [x] 6.4 运行 `pnpm lint`
- [x] 6.5 运行格式化检查或 `pnpm format`，按项目脚本保持 Prettier 输出一致
- [x] 6.6 运行 `pnpm build`
