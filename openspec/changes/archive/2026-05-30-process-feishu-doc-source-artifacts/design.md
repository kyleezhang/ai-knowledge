## Context

`import-feishu-doc-as-source` 已完成单个飞书文档导入为 `Source` 的能力，并将远端内容冻结到本地 raw artifacts。Feishu Doc Source 的后续学习流程依赖 `source process` 生成标准 processed artifacts；这些 artifacts 是 draft understanding、证据定位和后续 Note 生成的 gate。

当前实现与规格已经具备基础方向，但仍需要把 Feishu Doc Source 的 processing 行为收敛为明确契约：只读本地 snapshot、写标准三件套、使用一致 locator，并修正主规格中重复 `### Requirement:` 的标题格式，避免 archive 后规格不可读或校验语义不清。

## Goals / Non-Goals

**Goals:**

- 确保 Feishu Doc Source processing 只读取 `raw/original.md`，不访问远端飞书文档。
- 确保 processing 成功后写入并登记 `processed/clean_text.md`、`processed/segments.json`、`processed/metadata.json`。
- 确保 processed segments 使用 `locator.source_kind = feishu_doc` 与 `processed/segments.json#<segment_id>` refs。
- 确保 processing 失败进入 `failed` 状态并记录 `last_error.stage = processing`。
- 修正 `source-processing` 主规格中 Feishu requirement 标题格式。

**Non-Goals:**

- 不新增或修改 `source ingest feishu-doc` 命令。
- 不重新读取、刷新或同步远端飞书文档。
- 不支持飞书附件、图片 OCR、评论、多维表格、画板或嵌入内容下钻。
- 不改变 draft understanding、discussion、Note、index gates。
- 不引入新的外部依赖、数据库、Web UI 或向量检索。

## Decisions

1. **复用 Markdown processing，但显式标记 source_kind。**
   - Rationale: 导入阶段已经生成 `raw/original.md`，正文结构适合复用 Markdown normalization、heading、link 和 segment 逻辑。
   - Alternative considered: 新增独立 Feishu processor。该方案会重复 Markdown pipeline，且目前没有 block-level parser 的必要输入契约。

2. **processing 阶段禁止远端 Feishu 读取。**
   - Rationale: Source processing 必须基于导入时冻结的 raw material，保证可复现、可追溯。
   - Alternative considered: process 时重新调用 Feishu API。该方案会让同一 Source 的 processing 输入随远端变化漂移，并把权限失败引入 processing。

3. **locator 使用 `feishu_doc` 作为 source_kind。**
   - Rationale: 后续 evidence、debug 和 QA 需要知道 segment 来自飞书文档 snapshot，而不是普通本地 Markdown 文件。
   - Alternative considered: 继续使用 `markdown`。该方案最小改动，但丢失来源类型，不符合 Feishu-specific processing spec。

4. **缺失 snapshot 按 processing failure 处理。**
   - Rationale: Source 已经存在，导入 raw artifacts 不完整是 processing 阶段遇到的问题，应通过 Source state machine 进入 `failed` 并保留 error。
   - Alternative considered: 抛出未捕获 storage error。该方案不利于用户通过 `source show` 查看失败原因。

## Risks / Trade-offs

- [Risk] `feishu_doc` source_kind 需要扩展 processed segment schema → Mitigation: 只扩展枚举，不改变已有 Markdown/PDF/URL locator 字段。
- [Risk] 复用 Markdown processor 无法表达 Feishu block id → Mitigation: 本变更只要求 heading path 或等价 imported position；block-level locator 可作为后续能力追加。
- [Risk] 主规格已有 malformed requirement 标题 → Mitigation: 用本变更的 MODIFIED Requirements 完整替换对应 requirement，archive 时修正主规格。

## Migration Plan

- 已导入但未处理的 Feishu Doc Source 可直接运行 `ai-knowledge source process <source_id>`。
- 已处理的 Feishu Doc Source 如 locator 仍为 `markdown`，需要用户显式重新处理或未来单独设计 reprocess 能力；本变更不自动重写既有 processed artifacts。
- 主规格修正仅影响 OpenSpec 文档，不迁移运行时数据。

## Verification Strategy

- OpenSpec: `openspec validate process-feishu-doc-source-artifacts --strict`。
- Focused tests: Source workflow tests覆盖 Feishu Doc import -> process、missing snapshot failure、locator source_kind。
- CLI tests: `source process <source_id>` 对 Feishu Doc Source 的 human/JSON 输出。
- Full gates: `pnpm typecheck`、`pnpm lint`、`pnpm format:check`、`pnpm build`、`pnpm test`。
