## ADDED Requirements

### Requirement: TypeScript CLI Project Baseline
仓库 SHALL 定义一个由 pnpm 管理的 TypeScript Node.js ESM 项目，用于承载 `ai-knowledge` CLI。

#### Scenario: 开发者查看项目脚本
- **WHEN** 开发者查看 package metadata
- **THEN** 项目暴露 build、typecheck、test、lint 和 format 相关脚本
- **AND** package 声明可执行的 `ai-knowledge` CLI 入口

#### Scenario: TypeScript 项目编译为 ESM
- **WHEN** 项目执行 build
- **THEN** TypeScript 源文件被编译为 ESM JavaScript 输出
- **AND** 生成产物位于源码目录之外

### Requirement: Initial CLI Supports Repository Initialization
系统 SHALL 提供 `ai-knowledge init` 命令，用于初始化本地知识库存储目录结构。

#### Scenario: 用户初始化空的仓库存储目录
- **WHEN** 用户运行 `ai-knowledge init`
- **THEN** 系统在配置的 knowledge root 不存在时创建它
- **AND** 在其下创建 `candidates`、`sources`、`notes` 和 `index` 子目录
- **AND** 不创建任何示例知识数据

#### Scenario: 用户多次运行 init
- **WHEN** 用户在存储目录已经存在后再次运行 `ai-knowledge init`
- **THEN** 命令成功完成且不覆盖已有文件
- **AND** 必需的存储目录仍然存在

### Requirement: CLI Preserves Layer Boundaries
初始 CLI SHALL 将仓库初始化行为委托给 workflow 和 storage 模块，而不是直接管理 knowledge 路径。

#### Scenario: Init 命令执行
- **WHEN** 调用 `ai-knowledge init`
- **THEN** CLI 解析命令并调用 init workflow
- **AND** workflow 调用 storage initialization helpers
- **AND** CLI 打印 workflow result，且不直接构造 `knowledge/` 子路径

### Requirement: Initial Storage Directory Layout Matches Schema Baseline
初始化后的 storage root SHALL 匹配 schema baseline 定义的 MVP 顶层目录布局。

#### Scenario: Storage root 初始化完成
- **WHEN** 初始化成功完成
- **THEN** storage root 包含 `candidates`、`sources`、`notes` 和 `index` 顶层目录
- **AND** 在后续 workflow 创建 domain objects 之前，不创建 raw、processed、note 或 index object 文件

### Requirement: Scaffold Avoids Out-of-Scope P0 Features
初始化脚手架 SHALL NOT 实现未来阶段的 ingestion、retrieval 或 UI 能力。

#### Scenario: 项目脚手架完成初始化
- **WHEN** 添加 CLI 脚手架和 source tree
- **THEN** 不添加 PDF processing 行为
- **AND** 不添加 automatic collection 行为
- **AND** 不添加 vector retrieval 行为
- **AND** 不添加 Web UI
