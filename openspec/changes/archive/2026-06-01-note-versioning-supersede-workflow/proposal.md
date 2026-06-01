## Why

当前 `Note` schema 已经具备 `version`、`root_note_id`、`supersedes_note_id`、`superseded_by_note_id` 和 `superseded` 状态，但用户还没有受控方式在核心结论变化时创建新版 Note。随着主链路、归档和索引门槛已完成，需要补齐版本治理，避免旧结论继续代表当前主知识。

## What Changes

- 新增 Note supersede / versioning workflow，用于从已确认的新讨论结论创建新版 Note。
- 新版 Note 必须显式基于某个 approved Note，继承 `root_note_id`，设置 `version = old.version + 1`，并写入 `supersedes_note_id`。
- 旧版 Note 必须通过状态机进入 `superseded`，并写入 `superseded_by_note_id`。
- 新版 Note 初始仍为 `draft`，必须经过 lint / approve / index 才能进入主知识层。
- superseded Note 必须保留历史文件和引用价值，但不再参与当前主检索。
- supersede 时需要同步处理旧版 Index Entry，避免旧版 approved Note 继续污染 answer retrieval。
- `note show` 应能展示版本链关键信息，便于用户理解当前 Note 与历史版本关系。
- 本变更不实现自动判断核心结论变化、不实现无讨论直接出新版 approved Note、不引入向量检索或 Web UI。

## Capabilities

### New Capabilities

### Modified Capabilities

- `note-lifecycle`: 增加 Note versioning / supersede workflow，要求新版 Note 由已确认结论生成，旧版 Note 进入 `superseded`，版本链字段保持一致。
- `note-indexing`: 增加 superseded Note 的索引生命周期规则，要求旧版 Note 被 supersede 后退出主检索，且不能重新作为主 Index Entry。

## Impact

- Affected layers: domain、storage、workflows、CLI、indexing/retrieval、notes rendering/show、tests。
- Domain: 补齐 Note 状态机和 invariant，确保版本链字段一致。
- Storage: 复用现有 note repo 和 index repo，不新增存储后端。
- Workflows: 新增 version/supersede workflow，组合旧 Note、新 Note、Source 讨论确认和 Index Entry 清理。
- CLI: 新增显式命令入口，支持 `--json`。
- Rendering/show: 展示 `version`、`root_note_id`、`supersedes_note_id`、`superseded_by_note_id`。
- Tests: 覆盖版本链 invariant、workflow gates、index cleanup、retrieval 排除、CLI 输出和端到端回归。
