## Why

P1 需要让用户可以直接输入公开网页 URL，把网页正文纳入既有 `Source -> processed artifacts -> draft_understanding` 学习闭环，而不必先手动复制成 Markdown。该能力必须限制在用户显式提供的单页 public URL，避免演变成 crawling、搜索扩展或认证页面抓取。

## What Changes

- 明确 `ai-knowledge source ingest url <public_url>` 会抓取用户显式提供的 public URL，并把稳定页面快照保存为 `raw/fetched.html`。
- URL Source 创建后保持 `status = ingested`，记录 `ingest_type = input_url`、`content_type = link`、`origin.user_input_type = url` 和原始 `url`。
- 明确 `ai-knowledge source process <source_id>` 对 URL Source 只读取已冻结的 `raw/fetched.html`，不在 processing 阶段重新访问网络。
- 网页正文处理输出标准三件套：`processed/clean_text.md`、`processed/segments.json`、`processed/metadata.json`，并在 metadata 中保留标题、链接和 `source_url` 等可追溯信息。
- 对需要登录、cookie、session、权限令牌、爬取站内链接、搜索扩展或动态补抓的 URL 直接拒绝，不创建 `Source`。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `source-lifecycle`: 细化显式 public URL 抓取快照并创建 URL Source 的输入边界、落盘行为和拒绝条件。
- `source-processing`: 细化 URL Source 基于冻结 HTML snapshot 提取网页正文、生成标准 processed artifacts、以及不重新抓取远端页面的处理边界。

## Impact

- Scope：P1。
- Affected layers：domain、storage、processing、workflows、CLI、tests。
- 可能依赖 Node 内置 `fetch` 与轻量 HTML 正文抽取逻辑；不得引入浏览器自动化、数据库、Web UI、自动采集、站点 crawling 或向量检索。
- 不改变知识边界：URL 网页正文只是 raw/processed Source 材料，仍然必须经过 draft understanding、讨论收敛和用户显式确认后才能生成正式 `Note`。
