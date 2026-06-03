## Why

当前 answer workflow 在没有 approved Notes 命中时只能报告“没有相关已确认知识”，这能保护知识边界，但在用户希望基于已导入但尚未确认的资料获得临时参考时不够有用。需要增加一个显式 fallback 模式，让系统可以读取未确认材料，但必须清楚标注其状态、来源和限制，不能把它伪装成已确认知识。

本变更属于 **P3 scope**：在 approved Notes 优先的基础上增加显式启用的 unconfirmed material fallback；默认 P0 answer 行为保持不变。

## What Changes

- 新增 answer fallback 能力：当 approved Note 检索不足且用户显式启用 fallback 时，可检索未确认材料作为 secondary evidence。
- 定义可用的未确认材料范围：已处理 Source 的 processed artifacts、`draft_understanding`、discussion summary；不读取 raw artifacts 作为答案证据。
- 要求所有 fallback 内容显式标注为 unconfirmed，包括材料类型、状态、source_id、标题、证据定位和限制说明。
- 扩展 answer grounding：approved Notes 仍是 primary evidence；fallback 只能作为 secondary evidence，且不得生成 formal Note、不得写主索引、不得改变 Source / Note 状态。
- 扩展 CLI / workflow：增加显式开关启用 fallback；默认 `ai-knowledge answer` 不使用未确认材料。
- Non-goals：不新增 PDF、auto-collection、Web UI、数据库替换、vector retrieval 新能力；不允许从 raw material 直接生成正式 Note；不把 fallback 内容写入 main index。

## Capabilities

### New Capabilities
- `answer-fallback`: 定义 answer workflow 如何显式启用、检索、标注和使用未确认材料作为 secondary evidence。

### Modified Capabilities
- `answer-grounding`: 扩展 answer grounding 需求，使 fallback 只能在显式启用时使用，并必须标注 unconfirmed。
- `source-processing`: 扩展已处理 Source 产物作为 fallback evidence 的读取边界，明确 raw artifacts 不作为 fallback answer evidence。
- `draft-understanding`: 扩展 draft understanding 在 answer fallback 中的角色：可作为未确认理解参考，但不是 formal knowledge。
- `discussion-convergence`: 扩展 discussion summary 在 answer fallback 中的角色：可作为未确认讨论参考，但只有用户确认后才能进入 Note。

## Impact

- Affected layers: domain, storage, retrieval, workflows, agents, CLI, tests。
- Domain: 新增 unconfirmed evidence / fallback result 类型、schema、状态与标注校验。
- Storage: 读取 Source、processed artifacts、draft understanding、discussion summary；不手写 `knowledge/` 路径，不读取 raw artifacts 作为答案证据。
- Retrieval: 新增 fallback retrieval，按 Source 状态和 processed artifacts 可用性过滤候选。
- Workflows: answer workflow 在 approved Note 不足或显式 fallback 模式下组合 primary / secondary evidence。
- Agents: answer agent prompt/input 需要区分 approved notes 与 unconfirmed materials，输出必须保留限制说明。
- CLI: 为 `ai-knowledge answer` 增加显式 fallback 开关和 JSON 输出字段。
- Tests: 覆盖默认不 fallback、显式 fallback、标注完整性、raw artifact 禁止、状态不变、agent input 分离。