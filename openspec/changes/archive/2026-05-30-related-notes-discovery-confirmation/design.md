## Context

`Note.related_note_ids` 已经是 Note、rendered Markdown、Index Entry 的一部分，但当前 workflow 基本把 related notes 作为空上下文传给 Agent，缺少候选发现与确认机制。这样会导致两种问题：相关关系长期为空，或者未来如果让 Agent 直接填充，会把未经确认的关系写进 `note.json` 主真相。

本设计将 related notes 建模为“候选关系”而不是直接知识事实。候选可以由 approved Notes 的关键词、标题、结论和 metadata 匹配产生；只有用户明确确认后，workflow 才允许它们进入 `Note.related_note_ids`。

## Goals / Non-Goals

**Goals:**

- 从 approved Notes 中生成 related note candidates，并附带可解释 reason。
- 支持用户确认或拒绝候选关系。
- `note compose` 可使用 confirmed related notes 作为上下文，并只把 confirmed ids 写入 `note.json`。
- 防止 Note Agent 静默写入未确认 related ids。
- 保持 `note.json` 是正式知识主真相，`note.md` 和 index 继续从 `note.json` 派生。

**Non-Goals:**

- 不做 vector retrieval 或 embedding。
- 不把 draft、archived、superseded、unapproved Notes 作为主候选来源。
- 不自动修改已 approved Note 的 `related_note_ids`。
- 不引入 Web UI 或数据库。
- 不让 related notes 影响 Source approval、Note QA、Note approval 或主索引 gate。

## Decisions

1. **候选关系使用独立 workflow 产生，不由 Note Agent 自行决定。**
   - Rationale: Agent 可使用 confirmed related notes 作为上下文，但不能绕过确认 gate 写入主真相。
   - Alternative considered: 让 Note Agent 输出 `related_note_ids` 后直接接受。该方案简单但不可解释、不可确认。

2. **候选来源限定为 approved Notes。**
   - Rationale: related note 是正式知识之间的关系，候选池不应来自草稿或未确认材料。
   - Alternative considered: 同时从 Sources/Candidates 发现关系。该方案会混入未确认材料，违背主知识边界。

3. **P2 先用 keyword/metadata 规则，暂不使用 vector。**
   - Rationale: 当前 roadmap 中 vector retrieval 是后续能力；本变更只需要可解释、可测试的候选发现。
   - Alternative considered: 直接引入 embedding similarity。该方案会扩大依赖和验证复杂度。

4. **确认结果作为 compose 输入，而不是自动落盘到独立关系库。**
   - Rationale: 当前主真相是 `note.json`，最小实现可以让 `note compose` 接收 confirmed related ids 并写入新 Note。
   - Alternative considered: 新增 relationship store。该方案支持双向关系治理，但超出当前 issue。

## Risks / Trade-offs

- [Risk] keyword matching 候选质量有限 → Mitigation: 必须展示 reason 且需要用户确认，低质量候选不会自动写入。
- [Risk] 只写入新 Note 的 related ids，不回写旧 Note → Mitigation: 明确为单向关系；双向关系和已批准 Note 修改另起版本/关系治理 change。
- [Risk] CLI 确认流程可能增加 compose 前步骤 → Mitigation: 支持无候选/全拒绝时继续 compose，保持主链路可用。

## Migration Plan

- 既有 Note 的 `related_note_ids` 保持不变。
- 新的 compose workflow 可接受 confirmed related ids；没有提供时默认 `[]`。
- Index Entry 和 rendered Markdown 不需要迁移，继续从 Note 的 `related_note_ids` 派生。

## Verification Strategy

- OpenSpec: `openspec validate related-notes-discovery-confirmation --strict`。
- Domain tests: candidate/result schema、确认状态、非法未确认 id 拒绝。
- Workflow tests: 只从 approved Notes 生成候选、候选包含 reason、确认/拒绝、compose 只写 confirmed ids。
- CLI tests: related notes discover/confirm 或 compose 参数入口，覆盖 `--json`。
- Full gates: `pnpm typecheck`、`pnpm lint`、`pnpm format:check`、`pnpm build`、`pnpm test`。
