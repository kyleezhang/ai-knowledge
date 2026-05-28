## Why

Candidate domain contract 已实现，但候选对象还不能持久化或查看，后续自动采集链路无法形成可检查的候选池。

本变更补齐 Candidate 的本地文件系统存储与只读 CLI 查看能力，让系统可以保存、列出和展示 Candidate，同时继续保证 Candidate 不进入主知识层、不参与 answer 检索。

## What Changes

- 新增 Candidate storage/repo，用 `CandidateSchema` 读写 JSON。
- Candidate 保存到 `knowledge/candidates/YYYY/MM/<candidate_id>.json`。
- 新增只读 workflow：Candidate list 与 Candidate show。
- 新增 CLI：
  - `ai-knowledge candidate list`
  - `ai-knowledge candidate list --status <status>`
  - `ai-knowledge candidate show <candidate_id>`
  - 上述命令支持 `--json`。
- list 默认按 `collected_at desc` 排序。
- 明确 Candidate 不写入 `knowledge/index/`，answer 不检索 Candidate。

Non-goals:

- 不实现 GitHub Trending / Hacker News collector。
- 不实现 Candidate 去重、过滤、规则评分或推荐算法。
- 不实现 Candidate 选中、状态流转或转换 Source workflow。
- 不允许 Candidate 直接生成 Source、Note 或 Index Entry。
- 不新增 Web UI、数据库、向量检索或自动化调度。

Scope: P2 前置能力。该变更只提供 Candidate 持久化与只读查看，不开启自动采集或 Candidate -> Source。

## Capabilities

### New Capabilities

- `candidate-storage`: 定义 Candidate 本地文件系统存储、读取、列表、只读查看和 CLI 展示行为。

### Modified Capabilities

- `candidate-domain`: 放宽上一阶段“只实现 domain contract”的隔离描述，允许 Candidate storage/read-only CLI 接入，但仍禁止 Candidate 进入 main index、answer retrieval 或绕过 Source/Note gates。

## Impact

- Affected layers:
  - storage: 新增 Candidate path helper 与 candidate repo。
  - workflows: 新增 list/show Candidate 只读 workflow。
  - CLI: 新增 `candidate` 命令组及 `list`/`show` 子命令。
  - tests: 覆盖 storage、workflow、CLI、answer/index 隔离。
- API / data impact:
  - 新增 `knowledge/candidates/YYYY/MM/<candidate_id>.json` 文件布局。
  - 不改变 Candidate schema。
  - 不改变 Source、Note、IndexEntry、answer 现有行为。
- Dependencies:
  - 不新增运行时依赖。
