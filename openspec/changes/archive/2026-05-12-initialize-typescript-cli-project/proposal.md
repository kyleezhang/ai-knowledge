## Why

当前仓库已经具备产品规格、工作流规格、schema 规格、实现规格和 OpenSpec 能力边界，但还缺少可执行的 TypeScript CLI 工程基础。现在建立项目脚手架，可以为后续 P0 工作流实现提供可构建、可测试、可校验的工程底座，同时不改变既有知识生命周期语义。

## What Changes

- 将仓库初始化为由 pnpm 管理的 TypeScript + Node.js LTS + ESM 项目。
- 为 `ai-knowledge` 命令添加 CLI 入口，并提供首个安全的 `init` 命令。
- 添加源码、测试、lint、format、typecheck 和 build 所需的基础配置。
- 在 `src/` 下建立与 P0 分层实现相匹配的初始目录结构。
- 为本地 `knowledge/` 存储根目录及其必需子目录提供安全、幂等的初始化能力。
- 不引入 PDF、自动采集、向量检索或 Web UI 行为。

## Capabilities

### New Capabilities
- `project-initialization`: 覆盖 TypeScript CLI 工程脚手架、可执行命令基线、开发质量门禁，以及本地知识库目录初始化。

### Modified Capabilities

## Impact

- 新增 package、TypeScript、测试、lint、format 和 build 相关配置文件。
- 新增 `src/` 分层目录，并为仓库初始化提供最小 CLI、workflow、storage 支撑。
- 新增针对项目初始化行为的 Vitest 覆盖。
- 新增 pnpm 依赖元数据，用于运行时 CLI 解析、schema 校验和开发质量工具。
