## 1. Project Tooling

- [x] 1.1 添加 `package.json`，包含 ESM package metadata、`ai-knowledge` bin mapping，以及 build、typecheck、test、lint、format、format check 脚本。
- [x] 1.2 添加与 Node.js LTS 和 ESM 输出匹配的 TypeScript、Vitest、ESLint、Prettier 配置文件。
- [x] 1.3 添加 commander、zod、TypeScript、Vitest、ESLint、Prettier 的 pnpm dependency metadata。

## 2. Initial Source Structure

- [x] 2.1 创建 CLI、workflow 和 storage 初始化代码所需的最小 `src/` 分层结构。
- [x] 2.2 添加 storage configuration 支持，并将默认 `knowledge_dir` 设为 `./knowledge`。
- [x] 2.3 添加 storage initialization helpers，幂等创建 `candidates`、`sources`、`notes` 和 `index` 目录，且不写入示例数据。

## 3. Init Workflow and CLI

- [x] 3.1 实现 `init_workflow`，将目录创建委托给 storage helpers，并返回结构化 workflow result。
- [x] 3.2 实现 `ai-knowledge init` CLI command，使 CLI parsing 调用 workflow 并打印结果。
- [x] 3.3 确保 CLI 不直接构造 `knowledge/` 子路径，也不实现 storage 行为。

## 4. Tests and Validation

- [x] 4.1 添加 Vitest 覆盖，验证 storage initialization 能在临时位置创建必需目录布局。
- [x] 4.2 添加 Vitest 覆盖，证明 initialization 是幂等的，且不会覆盖已有文件。
- [x] 4.3 成功运行 typecheck、test、lint、format check 和 build 脚本。
