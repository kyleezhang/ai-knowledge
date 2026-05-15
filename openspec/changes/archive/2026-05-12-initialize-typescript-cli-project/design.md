## Context

当前仓库已经具备 AI 学习助手的产品、工作流、schema 和实现规格，也已经建立了围绕知识生命周期的 OpenSpec 能力边界。但仓库还没有可执行的 TypeScript 工程、package 元数据，也没有开始实现 P0 工作流所需的初始 CLI 入口。

这次 change 是工程基础建设：它建立构建工具、源码布局和最小的 `ai-knowledge init` 路径，同时保持现有对象边界、主真相边界和生命周期门禁不变。

## Goals / Non-Goals

**Goals:**

- 建立 pnpm + TypeScript + Node.js LTS + ESM 项目基线。
- 提供 typecheck、test、lint、format 和 build 脚本。
- 为 `ai-knowledge` 添加可执行 CLI 入口。
- 只实现 `ai-knowledge init` 所需的安全本地存储初始化行为。
- 创建与文档化分层一致的初始 `src/` 结构。
- 为初始化幂等性和目录创建行为添加测试。

**Non-Goals:**

- 不实现 Markdown ingest、processing、draft understanding、discussion、note composition、indexing 或 answering。
- 不添加 PDF、自动采集、向量检索、数据库存储或 Web UI 支持。
- 不调用真实 LLM，也不要求 API credentials。
- 不创建示例知识数据。

## Decisions

### Use pnpm with ESM TypeScript

使用 `package.json`、`pnpm-lock.yaml`、`tsconfig.json` 和 ESM 输出，因为实现基线已经明确选择 TypeScript、Node.js LTS、pnpm 和 ESM。

Alternatives considered:

- npm：默认心智更简单，但与项目基线不一致。
- CommonJS：历史兼容性更广，但与 ESM 基线和现代 Node.js 默认方向不一致。

### Use commander for CLI parsing

初始 CLI 使用 `commander`，因为它是实现规格中推荐的 P0 CLI 依赖之一，并且能让面向资源的命令树保持清晰、显式的注册方式。

Alternatives considered:

- `cac`：同样可行，但 `commander` 在嵌套命令和 help 输出上更常见。
- 手写参数解析：可以少一个依赖，但会在真实工作流出现前制造不必要的解析代码。

### Implement `init` through workflow and storage layers

`ai-knowledge init` 通过 `init_workflow` 调用 storage 初始化 helper。CLI 只负责解析参数和打印结果；目录创建职责归 storage 层所有。

Alternatives considered:

- 让 CLI 直接创建目录：实现更短，但违反 CLI 不直接管理 storage 内部细节的分层规则。
- 推迟 `init`：会导致工程基线缺少可执行行为，难以验证脚手架是否真的可用。

### Keep initial directory scaffolding minimal

只创建第一个实现切片真正需要的目录，并仅在源码导入需要时保留最小层级占位。未来阶段模块必须等对应行为通过聚焦 change 说明后再实现。

Alternatives considered:

- 一次性创建完整推荐目录树：视觉上完整，但容易产生投机性文件膨胀。
- 只创建 `src/cli/index.ts`：太薄，无法验证分层和 init 行为。

### Tests avoid real LLM calls

使用 Vitest 和临时目录验证 init 行为。这次 change 中的测试不依赖 credentials、网络访问或模型输出。

Alternatives considered:

- 调用已安装 binary 的端到端测试：后续有价值，但对当前脚手架不是必需，并且在 packaging 稳定前更脆弱。

## Risks / Trade-offs

- [Risk] 工具链初始化可能超过第一个行为切片的实际需要。→ Mitigation: 将运行时行为限制在 `init`，并只添加实现基线中已经确认的依赖。
- [Risk] 目录初始化可能覆盖用户数据。→ Mitigation: 目录创建必须幂等，且不得创建示例数据或覆盖已有文件。
- [Risk] CLI 形态会随着 P0 命令实现继续演进。→ Mitigation: 保持 `init` 独立，不提前注册尚未实现的占位命令。
- [Risk] `knowledge_dir` 配置后续可能需要更完整的配置加载。→ Mitigation: 当前只建立带默认值的小型 storage config 边界，将 model/API 配置留给后续 change。

## Migration Plan

1. 添加 package、TypeScript、lint、format 和 test 配置。
2. 添加 `src/cli/index.ts`、storage config/init helpers 和 `init_workflow`。
3. 添加基于临时目录运行 init 的测试，验证目录创建和幂等行为。
4. 使用项目脚本在本地完成 build、typecheck、test、lint 和 format check。

回滚方式是在后续实现依赖它之前移除这次脚手架变更。由于不会创建正式知识数据，因此不需要知识数据迁移。

## Open Questions

- 当前脚手架切片没有未决问题。后续 change 可以分别决定每个 P0 workflow command 的详细 CLI 输出。
