## Context

本变更位于 P0 主动学习闭环的入口阶段：Markdown 文件需要先被导入为 `Source`，后续才能进入 process、understand、discuss、approve 和 Note 生成流程。现有 `source-lifecycle` 与 `source-processing` specs 已定义 Source 的基本边界、状态和处理门槛；本设计只补齐 Markdown 导入和 Source 只读查看，不改变 Note、Index 或 Agent 行为。

当前约束：

- `Source` 是资料进入系统后的主工作对象，不是已确认知识。
- 导入只创建 `Source.status = ingested`，不得生成 `draft_understanding` 或 `Note`。
- 所有 `knowledge/` 路径必须通过 storage helpers 生成。
- Source 状态只能通过 domain state-machine helper 流转；本变更的导入流程创建初始状态，不执行跨状态推进。
- P0 只支持 Markdown 主动导入，不支持 PDF、自动采集、向量检索或 Web UI。

## Goals / Non-Goals

**Goals:**

- 实现 `ai-knowledge source ingest markdown <file>`，将本地 Markdown 导入为 `Source`。
- 按 schema layout 创建 Source 目录、`source.json`、`discussion.jsonl`、`raw/original.md` 和空 `processed/` 目录。
- 实现 `ai-knowledge source list` 与 `ai-knowledge source show <source_id>` 的只读查看能力。
- 为上述命令提供人类可读输出与 `--json` 输出。
- 使用 Vitest 覆盖 domain/storage/workflow/CLI 边界。

**Non-Goals:**

- 不处理 Markdown processing，不生成 `processed/clean_text.md`、`segments.json` 或 `metadata.json`。
- 不生成 `draft_understanding`。
- 不触发 discussion、Source approval、Note compose、Note lint、Note approve 或 indexing。
- 不支持 PDF、Feishu/Lark 文档、自动采集 Candidate、向量检索、数据库或 Web UI。
- 不引入 LLM 调用或新外部依赖。

## Decisions

### Decision 1: 导入 workflow 只创建 Source，不自动处理

`ingest_markdown_workflow` 只负责输入文件校验、metadata 提取、ID/slug 生成、Source 初始化和 raw 文件保存。成功后返回 `next_actions`，提示用户运行 `ai-knowledge source process <source_id>`。

Rationale: 这保持“资料进入”和“资料处理”的阶段边界，避免导入命令隐式推进状态或掩盖处理错误。

Alternatives considered:

- 导入后自动执行 process：更省操作，但会把 ingest 与 processing 失败语义混在一起，不利于 P0 验证状态机。
- 导入后自动生成 draft understanding：违反“无 processed artifacts 不生成 draft_understanding”的门槛。

### Decision 2: raw Markdown 固定保存为 `raw/original.md`

无论输入文件名是什么，P0 导入保存的 raw artifact 目标名固定为 `raw/original.md`，并由 storage artifact helper 复制原始内容。

Rationale: 固定路径使后续 processing workflow 可稳定读取 raw 输入，同时保留原始 Markdown 内容，不通过改写文件来隐藏处理问题。

Alternatives considered:

- 保留用户原始文件名：更接近输入，但会增加路径安全和后续读取分支。
- 只记录输入路径不复制：实现更简单，但破坏知识库自包含性，且外部文件移动后 Source 不可复现。

### Decision 3: Source list/show 走 workflow + repo，不直接拼路径

CLI 只解析参数并调用 `list_sources_workflow` / `show_source_workflow`。workflow 调用 `SourceRepo`，repo 通过 storage path/object-locator helpers 读取 Source。

Rationale: 这保持 CLI、workflow、storage 分层，并避免 CLI 直接依赖 `knowledge/` 文件布局。

Alternatives considered:

- CLI 直接扫描 `knowledge/sources`：实现快，但违反 layering rules，并导致未来 storage layout 变更时 CLI 受影响。

### Decision 4: show 默认展示控制面摘要，不输出完整正文

`source show` 默认展示 Source 元数据、状态、artifact refs、`draft_understanding.summary`（如存在）、`discussion_summary` 状态和 `note_ids`，不输出 raw 或 processed artifact 全文。

Rationale: show 命令用于判断工作流状态，不是内容阅读器；默认输出大正文会让 CLI 难用，也模糊 raw/processed 与已确认知识的边界。

Alternatives considered:

- 默认输出 raw Markdown：对调试有用，但可能造成误把 raw material 当知识结论的倾向；后续如需要可单独设计 artifact 查看命令。

### Decision 5: `--json` 输出 workflow data，不绕过格式化层

非交互命令支持 `--json`，CLI 将 workflow result 的 data 序列化输出。人类可读模式仅做摘要展示和 next actions 展示。

Rationale: 统一的 workflow result 方便测试和脚本化，也避免 CLI 重新推导业务状态。

Alternatives considered:

- 每个命令手写独立 JSON shape：短期灵活，但容易和 workflow/domain 对象漂移。

## Risks / Trade-offs

- [Risk] Source ID/slug 冲突导致覆盖已有 Source → Mitigation: 使用 domain ID/slug helper 并在 repo create 前检查存在，必要时追加短 hash。
- [Risk] 用户导入非 Markdown 或不存在文件 → Mitigation: workflow 在系统边界校验输入路径与扩展名/可读性，失败时不创建半成品 Source。
- [Risk] raw 文件复制过程中部分写入 → Mitigation: storage 层使用安全写入/创建顺序，失败返回 storage/workflow error，避免生成看似成功的 Source。
- [Risk] list 递归扫描在大量 Source 下变慢 → Mitigation: P0 使用本地文件递归扫描即可；大规模索引不是本变更目标。
- [Risk] show 输出过多内容导致用户误解 Source 为正式知识 → Mitigation: 默认只展示控制面摘要，并在文案中保持 Source/Note 边界。

## Migration Plan

这是 P0 新增能力，不需要迁移既有数据。实现顺序建议：

1. 确认或补齐 domain `Source` schema/type、ID/slug/time helpers 与 Source 初始对象构造所需字段。
2. 补齐 storage helpers/repo：Source 目录创建、raw 保存、空 discussion log、Source list/get。
3. 实现 `ingest_markdown_workflow`、`list_sources_workflow`、`show_source_workflow`。
4. 接入 CLI `source ingest markdown`、`source list`、`source show` 和 `--json`。
5. 添加测试并运行 OpenSpec validation、typecheck、test、lint、format/build。

Rollback strategy: 本变更不改变既有 schema 状态枚举；如 CLI 行为需要回退，可移除命令接线，同时保留已创建的 Source 文件作为普通 P0 Source 数据。

## Open Questions

- Markdown title 提取优先级是否严格采用 frontmatter `title` > 第一个 H1 > 文件名？若当前代码已有约定，应以当前实现和 specs/implementation.md 为准。
- `source show` 是否需要可选参数展示完整 `draft_understanding` 或 raw artifact？本变更默认不加入，避免扩大范围。
