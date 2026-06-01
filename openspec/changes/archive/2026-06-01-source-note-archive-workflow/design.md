## Context

`SourceStatusSchema` 和 `NoteStatusSchema` 已经包含 `archived`，主流程也已经有 `show/list`、Note approval、Index Entry 和 answer retrieval。当前缺口不是新增对象模型，而是缺少一个受控的归档 workflow：用户无法通过 CLI 将不再活跃的 Source 或 Note 移出当前工作集合，approved Note 归档后也需要确保不会继续污染主检索。

该变更应沿用现有分层：domain 定义状态流转，storage 只负责读写对象和索引文件，workflow 编排状态检查与持久化，CLI 只调用 workflow 并展示结果。归档不得修改 raw material、processed artifacts、discussion history 或 `note.md` 内容，避免破坏可追溯性。

## Goals / Non-Goals

**Goals:**

- 提供 `source archive` 和 `note archive` 两个显式 CLI 入口，均支持 `--json`。
- 所有归档状态变化必须通过 domain state machine。
- Source 归档保留全部 Source 目录和 artifacts，且 archived Source 仍可 `source show`。
- Note 归档保留 `note.json` 和 `note.md`，且 archived Note 仍可 `note show`。
- approved Note 归档后不再进入 answer 主检索。
- 归档 Note 时同步处理对应 Index Entry，避免旧索引继续作为主检索入口。
- 覆盖 workflow、CLI、retrieval/indexing 和 artifact 保留测试。

**Non-Goals:**

- 不实现 Note supersede 或版本链更新。
- 不实现恢复归档对象的 unarchive workflow。
- 不删除任何历史文件，也不做复杂 rollback 事务。
- 不引入数据库、向量索引、混合检索、Web UI 或定时任务。
- 不改变 Candidate 到 Source、Source 到 Note、QA approval 的既有门槛。

## Decisions

### 1. 归档使用既有 `archived` 状态，不新增 tombstone 对象

归档语义已经在 Source / Note schema 中预留，因此实现应复用 `status = archived`。这样 `list --status archived`、`show`、JSON parse 和历史引用都能沿用现有对象模型。

Alternative considered: 额外创建 `archive/` 目录或 tombstone metadata。该方案会引入新的路径迁移和对象定位问题，不符合“归档不删除、不移动、不重写历史”的目标。

### 2. Source archive 只改 Source 状态和 `updated_at`

Source 可能处于已导入、已处理、已理解、讨论中、已批准、已生成 Note 或 failed 等不同阶段。归档 Source 的目标是停止活跃工作流，而不是撤销历史。因此 workflow 应允许除 `processing` 和 `archived` 之外的 Source 通过 state machine 进入 `archived`，并只更新 `updated_at` 与必要状态字段。`processing` 表示操作正在进行，不在本变更中处理中断语义。

Alternative considered: 同时归档该 Source 生成的 Notes。该行为有较大副作用，因为 Note 是独立的正式知识对象，用户应显式执行 `note archive`。

### 3. Note archive 负责同步索引可见性

`answer` 当前从 Index Entry 开始检索，再加载 approved Note。只把 Note 改为 `archived` 已能在加载阶段过滤，但旧 Index Entry 仍会参与候选打分，造成无用命中和状态不一致。归档 Note 时应同步移除对应 Index Entry 或将其标记为非主检索。

当前 `IndexEntry.status` 只允许 `approved`，因此优先选择“删除对应 index file”。这不删除知识主真相；Index Entry 是可重建的检索入口，不是知识对象。若删除失败，workflow 返回结构化错误，避免报告归档成功但索引仍污染主检索。

Alternative considered: 扩展 IndexEntry status 增加 `archived`。这会扩大 schema 和 retrieval 变更范围；当前需求只需要主检索不返回 archived Note，删除索引更小、更符合现有 schema。

### 4. CLI 输出遵循现有 summary + next action 风格

`source archive` 成功后输出 Source summary；`note archive` 成功后输出 Note summary。归档通常没有下一步命令。JSON 输出直接返回 `WorkflowResult`，便于脚本使用。

Alternative considered: 增加交互确认提示。当前 CLI 其它状态变更命令没有交互确认，且归档是可追溯、不删除文件的低破坏操作；先保持非交互一致性。

## Risks / Trade-offs

- [Risk] 删除 Index Entry 失败会导致 Note 已归档但索引仍存在。→ Mitigation: workflow 应先准备索引操作并在失败时返回结构化错误；测试覆盖失败路径。若采用先归档 Note 再删除索引，需要在错误信息中明确 `PARTIAL_FAILURE`。
- [Risk] Source 归档后仍有已 approved Note 留在主检索，用户可能误以为 Source 归档会隐藏所有派生知识。→ Mitigation: proposal 和 CLI 文案保持 Source 与 Note 独立；需要隐藏知识时执行 `note archive`。
- [Risk] 直接删除 Index Entry 会让恢复归档 Note 需要重新 index。→ Mitigation: unarchive 不在本变更范围；未来恢复 workflow 可要求重新 `note index`。
- [Risk] 状态机当前可能只允许部分状态进入 `archived`。→ Mitigation: domain tests 明确 Source / Note 可归档状态，保持转换规则集中在 state machine。

## Migration Plan

- 无数据迁移：既有 Source / Note schema 已支持 `archived`。
- 新增 workflow 和 CLI 后，已有对象可继续被 show/list。
- 对已有 archived Note，如果 index file 已存在，后续实现可提供 focused cleanup 测试或在 `note archive` 对重复归档返回 INVALID_STATE，不主动扫描历史。
- 回滚策略：移除 CLI 和 workflow 不影响已有 JSON；`archived` 状态仍是 schema 合法值。

## Open Questions

- `note archive` 对 draft Note 是否也要尝试删除 index？按现有门槛 draft Note 不应有 index，workflow 可忽略 missing index。
- `source archive` 是否允许 `failed` Source 归档？建议允许，方便用户关闭无法继续处理的资料，但需要状态机明确支持。
