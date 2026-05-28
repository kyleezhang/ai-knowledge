## Why

Candidate domain 与本地只读候选池已经就绪，但系统还没有从外部来源创建 Candidate 的采集入口，候选池只能由测试或未来代码手工填充。

本变更新增 GitHub Trending 与 Hacker News 采集器，将外部条目规范化为 Candidate 并保存到候选池，同时确保自动采集内容不会直接成为 Source、Note 或 Index。

## What Changes

- 新增 GitHub Trending collector，将仓库条目规范化为 Candidate 创建输入。
- 新增 Hacker News collector，将 story 条目规范化为 Candidate 创建输入。
- 新增 collector 编排 workflow，将 collector 输出通过 Candidate repository 保存。
- 外部请求必须可注入 / mock，默认测试不依赖真实网络。
- 采集失败返回结构化错误，不产生半成品 Candidate。
- 自动采集只创建 Candidate，不创建 Source、不调用 Agent、不生成 Note、不写 main index。
- 采集结果以 `new` 状态进入候选池；后续去重、过滤、评分推荐留给下一阶段。

Non-goals:

- 不实现 Candidate 去重、过滤、评分推荐或推荐阈值。
- 不实现 Candidate 选中、状态流转或转换 Source。
- 不实现定时调度或后台自动运行。
- 不调用 LLM，不生成 draft understanding / Note / answer。
- 不新增数据库、Web UI 或向量检索。

Scope: P2 的第一步自动采集入口。该变更只负责采集外部条目并创建 Candidate。

## Capabilities

### New Capabilities

- `candidate-collectors`: 定义 GitHub Trending / Hacker News collector、collector 输出规范、错误处理和 Candidate-only 边界。

### Modified Capabilities

- `candidate-storage`: 允许 collector workflow 使用 Candidate repository 保存采集得到的 Candidate，但仍保持 Candidate 不进入 Source/Note/Index/Answer。

## Impact

- Affected layers:
  - collectors: 新增 GitHub Trending 与 Hacker News collector 模块。
  - workflows: 新增 collect Candidates workflow。
  - storage: 复用 Candidate repository 保存 collector 输出。
  - CLI: 可能新增显式 `collect` 命令或 `candidate collect` 命令用于手动触发一次采集。
  - tests: 覆盖 mocked 外部请求、规范化、错误处理、Candidate-only 隔离。
- API / data impact:
  - 生成 Candidate JSON，写入 `knowledge/candidates/YYYY/MM/`。
  - 不改变 Candidate schema。
  - 不写入 `knowledge/sources/`、`knowledge/notes/` 或 `knowledge/index/`。
- Dependencies:
  - 优先使用 Node 内置 `fetch`，不新增运行时依赖。
