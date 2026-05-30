## Why

`Note.related_note_ids` 已经存在于 Note schema、rendering 与 index entry 中，但当前没有系统化的“发现候选 -> 展示理由 -> 用户确认 -> 写入 Note”的流程。缺少这个 gate 会导致相关关系要么长期为空，要么由模型在 Note compose 时静默写入，破坏“正式知识必须经过确认”的边界。

本变更属于 P2 范围：在 approved Notes 之间建立可解释、可确认的关系，但不引入向量检索或自动无确认写入。

## What Changes

- 新增 related notes discovery workflow：基于 approved Notes 的 keyword/metadata/confirmed conclusions 产生 related note candidates。
- 每个候选必须包含 `note_id`、title/summary 片段和 relation reason。
- 新增用户确认/拒绝 related note 候选的流程；只有确认后的候选可进入 `Note.related_note_ids`。
- `note compose` 可接收 confirmed related notes 作为上下文，但 MUST NOT 接受 Note Agent 自行新增未确认的 `related_note_ids`。
- CLI 增加查看/确认 related notes 的入口，支持 `--json`。
- 非目标：不做向量检索、不做自动写入无确认关系、不修改 approved Notes 的主结论、不引入 Web UI、不让 unapproved/draft/archived/superseded Notes 成为候选主来源。

## Capabilities

### New Capabilities

- `related-notes`: 发现、展示、确认 approved Notes 之间相关关系的能力，包括候选生成、理由、确认状态和 Note compose 上下文。

### Modified Capabilities

- `note-lifecycle`: Note composition 必须只写入已确认 related note ids，禁止 Note Agent 静默创建未确认关系。
- `note-indexing`: Index Entry 继续包含 `related_note_ids`，但其来源必须是 `note.json` 中已确认的关系。

## Impact

- Affected layers: domain, retrieval/workflows, agents, CLI, tests。
- Domain: 增加 related note candidate/result 类型与确认状态校验。
- Retrieval/workflows: 从 approved Notes 中生成候选并记录/传递确认结果。
- Agent: `compose-note` 输入可带 confirmed related notes；输出仍需 schema validation，且 workflow 过滤未确认 related ids。
- CLI: 增加 related notes 发现/确认命令或 note compose 前的显式参数入口。
- Tests: 覆盖候选生成、只使用 approved Notes、确认/拒绝、Note compose 过滤、index/render 输出不变。
