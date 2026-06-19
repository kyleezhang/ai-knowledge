## Why

当前实现已经明显超过最初 P0 边界：除 Markdown 主链路外，代码中已经存在 PDF、URL、飞书文档导入、Candidate 自动采集、向量索引与 hybrid retrieval 等能力，但 `specs/implementation.md`、`AGENTS.md`、验收文档和命令语义仍混用“P0-only”描述。这会让后续开发不知道哪些能力是稳定能力、哪些是 Beta/Experimental，也容易弱化“默认回答只基于已确认 Note”的核心边界。

本变更先做规格与文档层面的能力边界对齐，不新增产品功能，目标是为后续优化 CLI 体验、P1 ingestion 稳定化、Candidate 治理和 Vector/Hybrid 产品化建立清晰地基。

## What Changes

- 新增一个能力阶段治理规范，定义当前已实现能力的阶段与稳定性标签：
  - P0 Stable：Markdown 主动学习闭环、approved Note 关键词/metadata 问答。
  - P1 Beta：PDF、显式公开 URL、飞书单文档导入。
  - P2 Experimental：Candidate 自动采集、评分、选择、定时自动化。
  - P3 Experimental：Vector indexing、hybrid retrieval。
- 更新现有 P0/P1/P2/P3 文档表述，使其描述“当前实现能力边界”，而不是过时的“尚未实现”边界。
- 明确 `ai-knowledge answer "<question>"` 默认只使用 approved Notes；未确认材料只能通过显式 `--fallback-unconfirmed` 进入，并必须被标记为未确认来源。
- 将“P0 Markdown-only 验收”与“扩展能力 smoke/acceptance 文档”拆开或重命名，避免 P0 smoke 文档覆盖 PDF/URL/vector/hybrid 后仍被误解为 P0-only。
- 保留已经实现的超 P0 命令，但在文档、CLI help 或验收说明中明确其 Beta/Experimental 属性。

Non-goals：

- 不新增 PDF、URL、飞书、Candidate、Vector 或 Hybrid 的运行时能力。
- 不引入 crawling、批量飞书同步、数据库、Web UI 或新的 embedding provider。
- 不改变 `note.json` 作为正式知识主真相的边界。
- 不允许 Candidate、raw Source、`draft_understanding` 或未确认 discussion 默认进入主 answer 证据层。

## Capabilities

### New Capabilities

- `capability-phase-governance`: 定义当前 CLI 能力的 P0/P1/P2/P3 阶段、Stable/Beta/Experimental 稳定性标签，以及文档、CLI help、验收说明应如何一致呈现这些边界。

### Modified Capabilities

- `answer-grounding`: 澄清默认 answer 必须只基于 approved Notes；显式 fallback 只能作为标记清楚的 secondary evidence。
- `answer-fallback`: 固化 `--fallback-unconfirmed` 的显式 opt-in、未确认标记、输出分区和不可变更知识状态约束。
- `end-to-end-acceptance`: 拆分 P0 Markdown-only 验收说明与扩展能力 smoke/acceptance 说明，避免 P0 文档混入 P1/P2/P3 覆盖范围。

## Impact

- Affected docs/specs:
  - `AGENTS.md`
  - `specs/implementation.md`
  - `specs/workflow.md` 中 answer / retrieval 阶段描述
  - `tests/p0-end-to-end-acceptance.smoke.md` 或等价验收说明文档
  - OpenSpec specs: `answer-grounding`、`answer-fallback`、`end-to-end-acceptance`
- Affected code, if implementation proceeds:
  - CLI help 文案可能需要标记 Beta/Experimental 命令。
  - `answer` 输出文案可能需要更明确地区分 approved Notes 与 unconfirmed fallback。
  - smoke/acceptance 文档或文件名可能需要重命名或拆分。
- Dependencies:
  - 不新增依赖。
- Compatibility:
  - 不移除现有命令，不破坏现有工作流。
  - 仅收紧文档和输出语义，默认 answer 行为保持 approved Notes 优先。