## Why

P0 主动学习闭环需要先具备稳定的 Markdown 资料入口和 Source 查看能力；否则后续处理、理解、讨论和 Note 生成都缺少可验证的起点。当前规格已经确认 Markdown 主动导入属于 P0，本变更将把该能力收敛为一个小而可独立实现的增量。

## What Changes

- 支持 `ai-knowledge source ingest markdown <file>`：用户导入本地 Markdown 后创建 `Source`，初始状态为 `ingested`。
- 导入时按 schema layout 创建 Source 目录，写入 `source.json`、空 `discussion.jsonl`，并将原始 Markdown 保存为 `raw/original.md`。
- 支持 `ai-knowledge source list`：按更新时间倒序查看 Source 队列，可按状态过滤。
- 支持 `ai-knowledge source show <source_id>`：查看单个 Source 的控制面状态和摘要信息，不默认输出完整 raw/processed 正文。
- 保持 P0 边界：不处理 PDF、不接入 Candidate 自动采集、不生成 draft understanding、不生成 Note、不建立索引。
- 保持知识边界：导入 Source 只表示资料进入系统，不等同于已确认知识。

## Capabilities

### New Capabilities

### Modified Capabilities
- `source-lifecycle`: 补充 Source list/show 的只读查看要求，并明确 Markdown 导入创建 Source 的 CLI 可观测输出。

## Impact

- Affected layers: domain, storage, workflows, CLI, tests.
- Domain: 需要复用 Source schema、ID/slug/time helpers、Source state-machine，不新增状态。
- Storage: 需要通过 storage path/repo/artifact helpers 创建 Source 目录、raw 文件、discussion log，并支持 list/get。
- Workflow: 新增或补全 ingest markdown、list sources、show source workflows。
- CLI: 新增或补全 `source ingest markdown`、`source list`、`source show` 命令与 `--json` 输出。
- Tests: 覆盖 Markdown 导入、Source 持久化布局、list/show 输出、状态过滤、无效输入与 raw 内容保留。
- Dependencies: 不新增 PDF、数据库、Web UI、自动采集或向量检索依赖。
