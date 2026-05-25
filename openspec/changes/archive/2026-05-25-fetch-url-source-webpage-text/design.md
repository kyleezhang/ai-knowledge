## Context

当前系统已经有 `Source` 生命周期、`raw/` / `processed/` 目录边界，以及 `ai-knowledge source ingest url <public_url>` 和 `ai-knowledge source process <source_id>` 的初步实现。这个变更不是引入广义网页采集，而是把用户显式输入的单页 public URL 稳定纳入主动学习路径。

URL Source 必须遵守与 Markdown/PDF 相同的知识边界：抓取结果只是 raw snapshot，网页正文处理结果只是 processed artifacts；后续仍必须经过 `draft_understanding`、多轮讨论、用户确认、Note QA 和索引门槛，不能从网页原文直接生成正式知识。

## Goals / Non-Goals

**Goals:**

- 支持用户通过 `ai-knowledge source ingest url <public_url>` 导入显式 public URL。
- 成功导入时保存冻结页面快照到 `raw/fetched.html`，并创建 `status = ingested` 的 URL Source。
- 支持 processing 阶段从 `raw/fetched.html` 提取可读正文，生成标准三件套 artifacts。
- 在 URL metadata 中保留 `source_url`、网页标题、链接等追溯信息。
- 明确拒绝非 public HTTP(S)、空 HTML、非 HTML 响应、认证/权限页面、以及需要 crawling/search expansion 的输入。

**Non-Goals:**

- 不做站点爬虫、搜索扩展、站内链接自动跟随或 RSS/自动采集。
- 不抓取需要登录、cookie、session、API token、内网或本地网络访问的页面。
- 不运行浏览器、不执行 JavaScript、不做动态渲染或反爬绕过。
- 不引入数据库、Web UI、向量检索或外部托管抓取服务。
- 不把 URL Source 的 raw/processed 内容直接提升为正式 `Note` 或主索引。

## Decisions

1. **ingest 阶段负责网络抓取，process 阶段只读取冻结快照。**

   URL 导入成功的前提是抓取到稳定 HTML，并写入 `raw/fetched.html`。后续 `source process` 只能读取该快照，不能重新访问网络。

   Alternative considered：processing 时再抓取网页。拒绝原因是会破坏可复现性，也会让同一个 Source 在不同时间处理出不同正文。

2. **只接受显式 public HTTP(S) 单页 URL。**

   输入必须是绝对 `http:` 或 `https:` URL，且不能指向 localhost、私网、`.local`、`.internal`、`.corp` 等明显非 public 范围。fetch 失败、非 HTML、空 HTML 或重定向后不再满足 public 条件时拒绝创建 Source。

   Alternative considered：允许更多协议或内网页面。拒绝原因是会引入 SSRF、权限、认证和不可复现问题。

3. **使用轻量 HTML-to-Markdown-like 正文抽取。**

   processor 删除 script/style/noscript/svg，保留 title、heading、paragraph、list、anchor，并把相对链接解析为绝对链接，产出统一 `DocumentProcessingResult`。

   Alternative considered：引入浏览器自动化或 Readability 级完整正文抽取依赖。拒绝原因是当前 P1 只需要稳定单页正文处理，复杂依赖和动态渲染会扩大范围。

4. **URL Source 继续复用标准 Source schema 和 artifact 三件套。**

   `Source` 记录 `ingest_type = input_url`、`content_type = link`、`origin.user_input_type = url`、`url`；正文、segments、links、`source_url` 等处理细节放在 processed artifacts 中。

   Alternative considered：新增 URL 专用 Source 字段保存正文或 fetch metadata。拒绝原因是会扩大控制面，且与 PDF/Markdown artifact 模型不一致。

## Risks / Trade-offs

- **正文抽取可能包含导航/页脚噪声** → P1 采用保守轻量抽取，并通过后续 `draft_understanding` 的不确定性和用户讨论修正理解。
- **不执行 JavaScript 会漏掉动态页面正文** → 明确作为非目标；用户可改用 Markdown/PDF 或后续单独变更支持动态渲染。
- **public URL 判定不能覆盖所有 SSRF 边界** → 先拒绝明显本地/私网/内部域名，并不支持自定义 header/cookie；如需更强网络安全策略，后续单独收敛。
- **远端页面会变化** → ingest 阶段保存 `raw/fetched.html`，processing 只读冻结快照以保证可追溯和可复现。

## Migration Plan

- 不需要迁移现有 Markdown/PDF Source、Note 或 Index。
- 已经成功导入但未处理的 URL Source 可直接运行 `ai-knowledge source process <source_id>`。
- 若已有 URL Source 的 `raw/fetched.html` 缺失，processing 应失败并记录 `last_error.stage = processing`。
- 回滚时保留已生成的 URL Source 目录和 raw snapshot；它们仍是普通 Source 数据，但 CLI 可停止暴露 URL ingest/process。

## Verification

- `openspec status --change fetch-url-source-webpage-text`
- `openspec validate fetch-url-source-webpage-text --strict`
- `pnpm typecheck`
- `pnpm test`
- `pnpm lint`
- `pnpm format:check`
- `pnpm build`
- 重点测试：URL ingest 成功落盘 `raw/fetched.html`、拒绝非 public/非 HTML/空响应、processing 不重新 fetch、HTML 正文/链接/metadata 提取、processed URL 可被 understand 消费。

## Open Questions

- 是否需要在后续变更中引入更强的正文抽取算法以降低导航噪声？
- 是否需要持久化 `fetched_at`、最终重定向 URL 或 HTTP headers 的精简审计信息？本变更先只保留 Source `url` 与 processed metadata 中的 `source_url`。
