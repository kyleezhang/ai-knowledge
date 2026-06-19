# capability-phase-governance Specification

## Purpose
TBD - created by archiving change align-implemented-capabilities. Update Purpose after archive.
## Requirements
### Requirement: Capability phase map is explicit
系统 SHALL 维护一份面向用户和开发者一致可见的 capability phase map，用于标记当前 CLI 暴露能力所属的阶段与稳定性。Phase MUST 使用 `P0`、`P1`、`P2`、`P3`；stability MUST 使用 `Stable`、`Beta`、`Experimental`。

#### Scenario: P0 stable capabilities are documented
- **WHEN** 用户或开发者查看项目能力边界说明
- **THEN** 文档 MUST 将 Markdown 主动学习闭环标记为 `P0 Stable`
- **AND** 该闭环 MUST 包含 `source ingest markdown`、`source process`、`source understand`、`source discuss`、`source approve`、`note compose`、`note lint`、`note approve`、`note index` 和默认 `answer`

#### Scenario: Extended capabilities are documented
- **WHEN** 用户或开发者查看项目能力边界说明
- **THEN** 文档 MUST 将 PDF、显式公开 URL、飞书单文档导入标记为 `P1 Beta`
- **AND** MUST 将 Candidate 自动采集、评分、选择与本地定时自动化标记为 `P2 Experimental`
- **AND** MUST 将 vector indexing 与 hybrid retrieval 标记为 `P3 Experimental`

### Requirement: Capability labels preserve workflow gates
阶段与稳定性标签 SHALL NOT 改变核心对象边界或 workflow gates。任何 Beta 或 Experimental 能力 MUST 继续遵守 Candidate、Source、Draft Understanding、Discussion Summary、Note、Index Entry 的主真相边界。

#### Scenario: Beta ingestion creates Source only
- **WHEN** P1 Beta ingestion 能力导入 PDF、显式 URL 或飞书单文档
- **THEN** 系统 MUST 创建或推进 `Source`
- **AND** MUST NOT 直接创建 formal `Note`
- **AND** MUST NOT 直接创建 main `Index Entry`

#### Scenario: Experimental Candidate stays outside main knowledge
- **WHEN** P2 Experimental Candidate 能力创建、评分或展示 Candidate
- **THEN** Candidate MUST NOT 进入主 answer evidence
- **AND** Candidate MUST NOT 创建 main `Index Entry`
- **AND** Candidate MUST 先经用户选择转换为 `Source` 后才能进入学习闭环

#### Scenario: Experimental retrieval locates approved Notes
- **WHEN** P3 Experimental vector 或 hybrid retrieval 被显式启用
- **THEN** 检索结果 MUST 只用于定位 approved Notes
- **AND** answer claims MUST grounded in approved `note.json`
- **AND** retrieval metadata MUST NOT become knowledge truth

### Requirement: CLI documentation exposes phase labels
系统 SHALL 在用户可见的命令说明、README、`AGENTS.md` 或等价文档中展示非 P0 Stable 命令的 Beta/Experimental 标签。标签 MUST 不改变命令名称或参数契约。

#### Scenario: User views ingestion commands
- **WHEN** 用户查看 source ingest 相关帮助或文档
- **THEN** `source ingest markdown` MUST be identified as `P0 Stable`
- **AND** `source ingest pdf`、`source ingest url`、`source ingest feishu-doc` MUST be identified as `P1 Beta`

#### Scenario: User views retrieval commands
- **WHEN** 用户查看 note index 或 answer 相关帮助或文档
- **THEN** keyword/metadata indexing and default answer MUST be identified as `P0 Stable`
- **AND** `note index --vector` and `answer --hybrid` MUST be identified as `P3 Experimental`

### Requirement: Implementation specs describe current reality
项目规格 SHALL 描述当前实现能力边界，而不是继续把已经暴露并测试的能力描述为“尚未接入”。如果某能力已经实现但稳定性不足，规格 MUST 用 Beta 或 Experimental 标记，而不是回避其存在。

#### Scenario: Spec describes P1/P2/P3 implemented commands
- **WHEN** `specs/implementation.md` 或等价规范列出 CLI 命令
- **THEN** it MUST include currently exposed P1/P2/P3 commands or explicitly point to their capability sections
- **AND** it MUST label those commands by phase and stability

#### Scenario: Spec preserves P0 default path
- **WHEN** `specs/implementation.md` 描述 P0 主链路
- **THEN** it MUST continue to identify Markdown + approved Note keyword/metadata answer as the stable baseline
- **AND** it MUST NOT imply Beta/Experimental capabilities are required for P0 success

