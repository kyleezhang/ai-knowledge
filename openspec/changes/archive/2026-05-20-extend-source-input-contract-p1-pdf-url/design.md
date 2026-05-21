## Context

当前实现基线只把 `ai-knowledge source ingest markdown <file>` 作为主动导入入口，后续 `process -> understand -> discuss -> approve -> note` 全部围绕 Markdown raw file 展开。但产品与阶段规划已经把 PDF 明确放入 P1，且项目上下文已确认 P1 还要增加“用户显式提供的 public URL”输入。这个扩展不是单点命令补充，而是同时影响 `Source` 的 schema 取值、raw material 保存方式、processing 输入、CLI 契约、测试覆盖与下游 workflow 边界。

这次设计的核心约束有三条：

1. 继续保留 `raw material -> processed artifacts -> draft_understanding -> approved Note` 的边界，不能让 PDF 或 URL 绕过标准化处理直接进入理解或成稿。
2. 继续使用单一 `Source` 作为主动学习流程的主工作对象，而不是为 PDF 或 URL 再发明新的主对象。
3. URL 输入必须保持“用户显式提供的单页 public URL”范围，不借机扩展到 crawling、搜索发现、登录态页面或批量抓取。

## Goals / Non-Goals

**Goals:**
- 为 P1 明确三类手动输入：Markdown、PDF、URL。
- 保持单一 `Source` 控制面，只扩展必要 enum 与 ingest / raw / processing 契约。
- 要求 PDF 与 URL 最终都归一化为 `processed/clean_text.md`、`processed/segments.json`、`processed/metadata.json`，保证下游 workflow 继续消费统一接口。
- 要求 URL 在 ingest 阶段就冻结抓取快照，避免后续 `process` 时再次联网导致内容漂移。
- 保持所有下游 gate 不变：没有 processed artifacts 不得 understand，没有讨论确认不得 compose Note，没有 QA passed 不得 approve Note。

**Non-Goals:**
- 不扩展 Candidate、自动采集、vector retrieval、Web UI 或 database。
- 不支持 crawling、站点级发现、搜索扩展、多 URL 批量导入、登录态页面、cookie/session 处理。
- 不改变 `note.json` / `note.md` / `Index Entry` 的真相边界。
- 不为 PDF 或 URL 增加新的 discussion、note 或 retrieval 特例流程。

## Decisions

1. **继续使用单一 `Source` 对象，只扩展输入枚举而不新增对象类型。**
   - 决策：在既有 `Source` 契约上扩展 `ingest_type`、`content_type` 与 `origin.user_input_type` 的允许值，而不是引入 `PdfSource`、`UrlSource` 之类的新主对象。
   - 约定：
     - Markdown: `ingest_type = upload_markdown`, `content_type = document`, `origin.user_input_type = markdown`
     - PDF: `ingest_type = upload_pdf`, `content_type = document`, `origin.user_input_type = pdf`
     - URL: `ingest_type = input_url`, `content_type = link`, `origin.user_input_type = url`
   - 额外约束：URL Source 的 `url` 必须非空；本地文件导入的 `url` 保持 `null`。
   - Rationale: 这样可以把变化限制在 enum、validator、CLI 和 processor 层，不破坏现有 `Source -> Note` 边界。
   - Alternatives considered:
     - 为 PDF / URL 建立独立主对象：会让 storage、workflow、agent 全部分叉，超出本次变更目标。
     - 用一个不透明 `source_input` blob 兜底：会弱化 schema 约束，后续更难测试和演进。

2. **按输入类型保留 raw material，但强制输出统一 processed artifacts。**
   - 决策：
     - Markdown raw 固定为 `raw/original.md`
     - PDF raw 固定为 `raw/original.pdf`
     - URL raw 固定为 `raw/fetched.html`
   - 无论输入类型如何，处理完成后都必须写出：
     - `processed/clean_text.md`
     - `processed/segments.json`
     - `processed/metadata.json`
   - Rationale: raw 层保留原始可追溯材料，processing 层负责归一化，下游 workflow 与 agents 只面对统一 processed 契约。
   - Alternatives considered:
     - 让 PDF / URL 使用各自专有 downstream 字段：会把格式差异泄漏到 understand / discuss / note 阶段。
     - 只保留提取后的纯文本，不保留原始 PDF / HTML：会削弱失败排查和来源追溯能力。

3. **URL 内容在 ingest 阶段抓取并冻结，而不是在 processing 阶段实时拉取。**
   - 决策：`ai-knowledge source ingest url <public_url>` 只有在成功抓到页面快照后才创建 `Source`，并把 HTML snapshot 保存到 `raw/fetched.html`；后续 `source process` 只读取本地 snapshot，不再重新联网抓取。
   - Rationale: 这符合“先把资料进入系统，再进入既有工作流”的产品语义，也能避免 URL 内容随时间变化导致后续理解与讨论不可复现。
   - Alternatives considered:
     - 在 `source process` 时再拉取 URL：会让 ingest 成功但 process 结果依赖稍后网络状态，破坏 Source 的稳定输入边界。
     - 每次 processing 都重新抓取：会导致 Source 原始材料漂移，难以审计讨论与 Note 结论到底对应哪一版网页。

4. **URL 范围严格限制为用户显式提供的单页 public URL。**
   - 决策：只接受用户直接输入的公开页面 URL；拒绝需要登录、cookie、session、权限令牌的页面，也不支持 crawling、site discovery、search expansion 或批量抓取。
   - Rationale: 这与项目记忆中的 P1 范围一致，能把这次变更保持为“新增一种手动 ingest path”，而不是把系统扩展成网页采集器。
   - Alternatives considered:
     - 同时支持受保护页面：会引入鉴权、安全与配置复杂度，不适合当前阶段。
     - 同时支持站点级抓取：会与后续 Candidate / auto-collection 范围混淆。

5. **理解阶段继续只消费标准化 artifacts，不感知 PDF / HTML 原始格式。**
   - 决策：`understand` workflow 与 Understand Agent 输入契约只读取 `processing_artifacts.clean_text`、`segments`、`metadata`，不直接读取 `raw/original.pdf` 或 `raw/fetched.html`。
   - Rationale: 这样可以把格式差异封装在 processing 层，保持 understand / discuss / note 的产品语义与测试边界稳定。
   - Alternatives considered:
     - 为 PDF 或 URL 单独定制 Understand Agent 输入：会增加 prompt 与测试分叉，但对当前产品价值不大。

6. **CLI 继续采用资源化子命令扩展，而不是引入新的顶层导入命令。**
   - 决策：新增 `ai-knowledge source ingest pdf <file>` 与 `ai-knowledge source ingest url <public_url>`，并保持非交互命令的 `--json` / `next_actions` 契约不变。
   - Rationale: 这与现有 `source ingest markdown <file>` 形式一致，用户认知和自动化调用都更稳定。
   - Alternatives considered:
     - 改成 `source ingest <type> <value>`：虽然更通用，但会让参数校验与帮助信息更弱。
     - 新增单独 `fetch` 命令：会把 URL 输入从 `Source` 生命周期中人为拆开。

## Risks / Trade-offs

- [Risk] PDF 文本提取质量和网页正文抽取质量会受输入内容复杂度影响。 → Mitigation: 保留 `raw/original.pdf` 与 `raw/fetched.html`，并要求失败显式停留在 ingest / processing 阶段，不静默修复。
- [Risk] URL 在 ingest 阶段抓取会让 ingest 命令比本地文件导入更慢。 → Mitigation: 接受这一步同步成本，以换取后续 processing、understand 与 discussion 的可重复性。
- [Risk] 新增 enum、raw layout 与 command path 会扩大 validator / test 变更面。 → Mitigation: 把变化集中到 domain schema、storage helper 与 workflow 边界测试，避免下游能力分叉。
- [Risk] 如果未来需要受保护 URL 或 crawling，这次 contract 可能需要再次扩展。 → Mitigation: 当前明确把这些能力排除在外，避免在 P1 里预埋过度抽象。

## Verification Strategy

- 对 OpenSpec change 运行 validation，确认 proposal / design / specs / tasks 结构完整。
- 为 domain / storage 增加针对新 enum、raw layout 与 path safety 的测试。
- 为 workflows / CLI 增加 PDF ingest、URL ingest、URL rejection、processing normalization 与 next action 的测试。
- 保持 understand 相关测试使用 fake agents，确认 PDF / URL 仍通过标准化 artifacts 进入 `draft_understanding`。
- 在实现阶段运行 typecheck、Vitest、lint / format check 与 build，确认没有破坏现有 Markdown 链路。

## Migration Plan

- 现有 Markdown Source、Note 与 Index Entry 不需要迁移。
- 新增的 `ingest_type` / `origin.user_input_type` / raw layout / CLI path 都是增量扩展，不影响既有 Markdown 数据。
- URL ingest 只有在成功获取 raw snapshot 时才创建 Source，因此不会留下“只有 URL 没有 raw material”的半成品主对象。
- 如需回滚，只需移除新的 CLI 分支与 processor 路径；现有 Markdown 工作流保持兼容。

## Open Questions

- None.
