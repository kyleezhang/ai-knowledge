## Context

当前系统已经有严格的 Source 生命周期：用户导入资料后创建 `Source`，处理阶段生成 `processed/` artifacts，之后 `understand` 才能基于 artifacts 生成 `draft_understanding`。P1 已经把 PDF 主动导入纳入 Source 生命周期，本变更只补齐 PDF Source 从 `raw/original.pdf` 到标准 processed artifacts 的处理闭环。

现有实现边界需要保持不变：`raw/` 保存原始资料，`processed/` 保存可理解中间产物，`source.json.processing_artifacts` 只登记相对路径；正式 `Note` 仍只能从讨论确认后的结构化结论生成，不能从 PDF 原文或 draft 直接生成。

## Goals / Non-Goals

**Goals:**

- 让 `ai-knowledge source process <source_id>` 能处理 `ingest_type = upload_pdf` 的 Source。
- PDF 处理产出与 Markdown/URL 一致的三件套：`clean_text`、`segments`、`metadata`。
- 保留 page-aware 信息，使后续理解阶段可以知道页数和页级上下文。
- 使用既有 Source state machine 和 `last_error.stage = processing` 失败语义。
- 增加测试覆盖 PDF 成功处理、raw 缺失、处理失败、后续 understand 只依赖 processed artifacts 的路径。

**Non-Goals:**

- 不做 OCR、扫描版 PDF 识别、图片/表格还原或版面级精排。
- 不改变 `Source`、`Note`、`Index Entry` 的主 schema 边界。
- 不让 PDF 处理直接生成 `draft_understanding`、`Note` 或索引。
- 不引入 Web UI、数据库、自动采集、URL crawling 或向量检索。
- 不支持需要密码、权限或远程抓取的 PDF 输入。

## Decisions

1. **复用标准三件套 artifact，而不是新增 PDF 专用 workflow 字段。**

   PDF 输出写入 `processed/clean_text.md`、`processed/segments.json`、`processed/metadata.json`，`source.processing_artifacts` 仍只记录这三个相对路径。页数、页标题、提取时间等 PDF 细节放入 `metadata.json` 或 `segments.json` 内容中。

   Alternative considered：给 `Source` 增加 `pdf_metadata` 或 `page_refs` 字段。拒绝原因是这些属于处理产物细节，不应扩大 Source 控制面，也会让后续格式扩展产生字段膨胀。

2. **PDF processor 负责抽取和归一化，workflow 只负责编排。**

   `src/processing/pdf-processor.ts` 读取二进制输入并返回 `DocumentProcessingResult`；`src/workflows/process-source-workflow.ts` 根据 `source.ingest_type` 分发到 PDF processor，并统一写 artifacts、更新状态和错误。

   Alternative considered：在 workflow 中直接调用 PDF 库并组装 artifacts。拒绝原因是 workflow 不应承载格式解析细节，且不利于单测替换 processor。

3. **用页级 Markdown heading 表达 page-aware 文本。**

   PDF 提取文本按页组织为 `## Page N` 段落，再进入通用 segmenter。这样无需新增分段 schema，也能让 `heading_path` 和 `metadata.page_count` 暴露页级上下文。

   Alternative considered：为 segment 增加必填 `page_number` 字段。拒绝原因是 Markdown/URL 不天然有 page 概念；把 page 信息做成通用文本结构可以保持 schema 稳定。

4. **失败语义沿用 processing 阶段。**

   `raw/original.pdf` 缺失、PDF 解析失败或 artifact 写入失败，都返回 workflow failure；Source 尽可能转为 `failed`，并写入 `last_error.stage = processing`。原始 PDF 不被改写或删除。

   Alternative considered：解析失败时生成空 artifacts 并继续。拒绝原因是这会破坏“无 processed artifacts 不生成 draft_understanding”的门槛，也会把错误伪装成可理解材料。

## Risks / Trade-offs

- **PDF 提取质量受库能力限制** → P1 只承诺可解析 PDF 的正文抽取与页级组织；扫描版/OCR 留到后续变更。
- **长 PDF 可能生成很大的 artifacts** → 本变更不做复杂 chunking 策略，只复用现有 segmenter；后续如出现上下文压力，再在理解阶段做 token budget 截断。
- **PDF 库对损坏文件抛出底层错误** → workflow 统一转换为 `PROCESSING_FAILED` 或 `STORAGE_FAILED`，并记录 `last_error` 供用户重试或人工处理。
- **页级 heading 不是精确引用系统** → 当前只用于理解阶段上下文，不作为正式证据引用的唯一机制；正式 Note 仍通过 `source_refs` 追溯到 processed artifacts。

## Migration Plan

- 不需要迁移现有 Markdown Source 或 Note。
- 已导入但未处理的 PDF Source 可直接运行 `ai-knowledge source process <source_id>`。
- 若已有 PDF Source 处于 `failed` 且 `last_error.stage = processing`，实现可按既有 retry 语义从失败状态重新进入处理阶段；本变更不新增强制修复命令。
- 回滚时只需移除 PDF 分发和 processor 行为；已生成的 `processed/` artifacts 仍是普通 Source artifacts，不影响 Markdown 路径。

## Verification

- `openspec status --change process-pdf-source-artifacts`
- `openspec validate process-pdf-source-artifacts --strict`（若项目启用该命令）
- `pnpm typecheck`
- `pnpm test`
- 重点测试：PDF Source 成功处理、缺少 `raw/original.pdf` 失败、PDF processor 抛错失败、processed PDF 可被 `understand_source_workflow` 消费。

## Open Questions

- P1 是否需要为“扫描版 PDF / 无文本 PDF”给出更友好的错误分类？当前统一视为 processing failure。
- 后续是否需要更细的 evidence ref，例如 `processed/segments.json#seg_0003` 到页码的稳定映射？本变更先不扩展 schema。
