## Why

当前项目已经支持 related note discovery 与 `note compose --related-note`，即 `Note.related_note_ids` 可以保存用户显式确认的知识关系。但 `answer` workflow 仍主要只使用直接检索命中的 approved Notes，尚未利用这些已确认关系扩展回答上下文。

这会让知识网络停留在展示层：用户已经确认了 Note A 与 Note B 的关系，但当问题直接命中 Note A 时，Note B 不会作为补充上下文参与回答，导致跨笔记综合能力不足。

本变更属于 **P2+ / Answer quality scope**：复用已有 `related_note_ids`，让 answer workflow 在直接命中 approved Notes 后加载一跳 related approved Notes 作为补充上下文，同时继续保持答案只基于 approved `note.json`，不碰 raw Source、`draft_understanding` 或 discussion-stage material。

## What Changes

- 扩展 answer retrieval 结果，区分 `direct` match 与 `related` expansion。
- 当 answer workflow 找到直接命中的 approved Notes 后，基于这些 seed notes 的 `related_note_ids` 加载一跳 related approved Notes。
- related expansion 只允许加载当前仍为 `approved` 的 Note；draft、archived、superseded、missing 或 unloadable Note 必须跳过。
- 扩展结果需要去重：同一 Note 同时直接命中和 related 命中时只保留 direct role。
- 为 related expansion 设置明确上限，避免上下文膨胀。
- `answer --json` 输出中暴露 direct / related role、`related_via_note_id` 和跳过 / 截断 debug 信息。
- Answer Agent 仍只接收 approved Notes；retrieval metadata 和 related expansion explanation 只作为调试 / 展示信息，不成为知识真相。
- Non-goals：不自动生成或修改 `related_note_ids`，不做多跳图遍历，不引入图数据库，不使用 LLM 动态判断关系，不让未确认材料进入主回答上下文。

## Capabilities

### Modified Capabilities

- `answer-grounding`: 扩展 answer evidence 规则，允许 related approved Notes 作为补充上下文，但必须区分 direct 与 related，并继续 grounded in approved `note.json`。
- `related-notes`: 扩展 related note 用途，从 compose/render 展示进入 answer context expansion，同时保持关系写入必须显式确认。
- `hybrid-retrieval`: 扩展 retrieval result 语义，使 direct hybrid matches 可以触发一跳 related expansion，但 retrieval metadata 不成为 answer evidence。

## Impact

- Affected layers: domain, retrieval, workflows, agents, CLI, tests。
- Domain: 新增或扩展 retrieval role / related expansion metadata 类型，字段保持 snake_case。
- Retrieval: 在 approved Note direct results 之后执行 one-hop related expansion、dedupe、approved-only filter 和 cap。
- Workflows: answer workflow 传给 Answer Agent 的 approved notes 包含 direct notes first、related notes after。
- Agents: Answer Agent prompt / input 如需扩展，应只表达 approved Note 的 direct/related role，不接收 raw Source 或 unconfirmed material 作为 confirmed evidence。
- CLI: `answer --json` 暴露 related expansion debug；默认人类输出保持简洁。
- Tests: 覆盖 direct expansion、skip non-approved related notes、dedupe、cap、JSON debug 和 grounding boundary。
