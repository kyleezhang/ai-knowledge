## Why

当前 `Source` 与 `Note` schema 已经包含 `archived` 状态，但用户还没有可执行的归档入口。随着 P0/P1 主链路、Candidate、飞书文档和 related notes 已经跑通，需要补齐治理能力，让用户可以把不再活跃的资料和笔记移出当前主流程，同时保留历史可追溯性。

## What Changes

- 新增 `ai-knowledge source archive <source_id>`，通过状态机将可归档 Source 置为 `archived`。
- 新增 `ai-knowledge note archive <note_id>`，通过状态机将可归档 Note 置为 `archived`。
- 归档只改变对象状态和更新时间，不删除 `raw/`、`processed/`、`discussion.jsonl`、`note.json` 或 `note.md`。
- `note show` / `source show` 仍可查看 archived 对象，用于历史追溯。
- 主检索必须排除 archived Notes；归档 approved Note 时，对应 Index Entry 需要从主检索中移除或标记为非主检索。
- 归档是 P2 治理能力，不引入 Web UI、数据库、向量检索、自动采集调度或 Note supersede 版本化。

## Capabilities

### New Capabilities

### Modified Capabilities

- `source-lifecycle`: 增加 Source archive workflow 与 CLI 入口，要求通过状态机进入 `archived`，且不删除任何 Source artifacts。
- `note-lifecycle`: 增加 Note archive workflow 与 CLI 入口，要求通过状态机进入 `archived`，且 archived Note 仍可 show 但不作为当前主知识。
- `note-indexing`: 增加 archived Note 的索引可见性规则，要求主检索不返回 archived Note，并在归档时同步清理或停用对应 Index Entry。

## Impact

- Affected layers: domain、storage、workflows、CLI、retrieval/indexing、tests。
- Domain: 使用既有 `archived` 状态与状态机，必要时补齐可归档状态约束。
- Storage: 复用现有 Source / Note / Index repo，不引入新存储后端。
- Workflows: 新增 source archive 与 note archive workflow，归档 Note 时处理 Index Entry 生命周期。
- CLI: 新增 `source archive` 与 `note archive`，支持 `--json`。
- Retrieval/indexing: 确保 answer retrieval 不返回 archived Note；归档后旧 index 不污染主检索。
- Tests: 覆盖 workflow、CLI、状态约束、artifact 保留、retrieval 排除和 index lifecycle。
