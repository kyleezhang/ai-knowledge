## Context

`Note` 对象已经预留版本治理字段和 `superseded` 状态，但当前只有 compose、lint、approve、index、archive 等单版本生命周期。用户在核心结论变化时只能创建一个新的独立 Note，无法表达“新版替代旧版”的关系，也无法保证旧版退出主检索。

该变更属于 P2 治理能力，应复用现有 Source -> Discussion -> Approval -> Note 门槛。新版 Note 不能直接从旧 Note 或 raw material 生成最终 approved 版本；它必须基于一个已经讨论收敛并 `approved_for_note` 的 Source 生成 draft，再经过 lint / approve / index。

## Goals / Non-Goals

**Goals:**

- 提供显式 supersede workflow / CLI，用于从已确认的新 Source 结论创建新版 Note。
- 新版 Note 继承版本链根节点，`version = old.version + 1`，并写入 `supersedes_note_id = old.id`。
- 旧版 approved Note 通过状态机进入 `superseded`，并写入 `superseded_by_note_id = new.id`。
- 新版 Note 初始为 `draft`，必须通过既有 lint / approve / index gates 才能成为主知识。
- superseded Note 保留 `note.json` / `note.md`，但退出主检索。
- `note show` / summary 展示版本链字段，支持用户追溯版本关系。
- 覆盖 domain invariant、workflow、CLI、index cleanup、retrieval 和 rendering/show 测试。

**Non-Goals:**

- 不自动判断“核心结论是否变化”；是否创建新版由用户显式触发。
- 不允许无讨论确认直接从旧 Note 生成新版 approved Note。
- 不实现并列主题拆分、多父版本合并或复杂分支版本图。
- 不实现 un-supersede / rollback workflow。
- 不引入数据库、向量检索、混合检索、Web UI 或异步 job。
- 不改变 `note.md` 作为渲染视图、`note.json` 作为正式知识主真相的边界。

## Decisions

### 1. 新版 Note 仍通过 Source confirmation gate 创建

Supersede workflow 应接收 `old_note_id` 和 `source_id`。`old_note_id` 必须指向当前 `approved` Note；`source_id` 必须指向 `approved_for_note` Source。workflow 复用 Note composition 约束：结论来自 `discussion_summary.confirmed_points`，evidence refs 来自 processed segments，related notes 仍需显式确认。

Alternative considered: 直接基于旧 Note 编辑生成新版。该方式会绕过“先讨论后落笔”的核心门槛，并且难以追溯新结论的来源证据。

### 2. 新版 Note 初始为 draft，不直接替代为 approved

创建新版时只建立版本链草稿，不自动 approve。用户仍需运行 `note lint`、`note approve`、`note index`。这保持 QA gate 不变，并避免未检查的新版直接进入主知识层。

Alternative considered: 一步创建 approved 新版并 supersede 旧版。该方式会绕过 lint / approval gate，不符合现有 Note 生命周期。

### 3. 创建新版和 supersede 旧版在同一 workflow 中完成

如果新版 Note 已创建但旧版状态更新失败，workflow 应返回 `PARTIAL_FAILURE`，与既有 compose Note 后 Source 更新失败的策略一致。旧版一旦 superseded，其主 Index Entry 应被移除，防止旧结论继续参与 answer retrieval。

Alternative considered: 先 supersede 旧版，再创建新版。该顺序可能导致旧版已退出主知识但新版创建失败，用户暂时没有当前版本。

### 4. 版本链使用线性链，不支持分支

每个新版只 supersede 一个旧版；`root_note_id` 始终指向第一版；`supersedes_note_id` 和 `superseded_by_note_id` 形成线性链。workflow 应拒绝 supersede 已 `archived`、`superseded` 或非 approved 的旧 Note。

Alternative considered: 支持多分支版本图。当前 CLI-first 本地知识库不需要复杂版本 DAG，线性链更容易展示、测试和检索。

### 5. Index cleanup 继续删除主 Index Entry

沿用 archive workflow 的决策：Index Entry 是可重建的检索入口，不是知识主真相。旧版 Note 进入 `superseded` 时移除对应 index file；新版 draft 不创建 index，直到 approve 后用户显式 `note index`。

Alternative considered: 扩展 IndexEntry status 为 `superseded`。这会扩大 schema 和 retrieval 范围，当前只需要主检索不返回 superseded Note。

## Risks / Trade-offs

- [Risk] 新版 Note 创建成功但旧版 supersede 或 index cleanup 失败。→ Mitigation: 按 `PARTIAL_FAILURE` 返回，保留已创建新版 Note，并在错误中明确需要人工处理旧版状态或索引。
- [Risk] 用户把普通措辞修改当作新版本。→ Mitigation: CLI 文案和 docs 明确仅核心结论变化才使用 supersede；普通显示修改应更新结构化 Note 后 render。
- [Risk] 旧版退出主检索后，新版 draft 尚未 approve/index，相关主题暂时无当前主知识。→ Mitigation: workflow 返回 next actions，提示 lint/approve/index 新版；这是保留 QA gate 的必要代价。
- [Risk] 版本链字段不一致导致 show/retrieval 混乱。→ Mitigation: domain invariant 和 workflow tests 覆盖 root、version、supersedes/superseded_by 的一致性。

## Migration Plan

- 无数据迁移：既有 Note schema 已包含版本字段和 `superseded` 状态。
- 新 workflow 只影响用户显式执行 supersede 的 Note。
- 旧 Note 的历史 `note.json` / `note.md` 保留原路径，不移动目录。
- 若未来需要恢复版本，可新增独立 rollback/un-supersede change；本变更不实现。

## Open Questions

- CLI 命令名建议为 `ai-knowledge note supersede <old_note_id> <source_id>`，实现时可根据现有 commander 风格微调。
- 新版 Note 是否允许继承旧版 `related_note_ids` 作为 confirmed related notes：建议不自动继承，除非用户通过显式参数确认，避免静默写入关系。
