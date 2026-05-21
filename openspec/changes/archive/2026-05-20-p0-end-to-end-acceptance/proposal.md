## Why

当前仓库已经分别实现了从 Markdown 导入到 approved Note 问答的 P0 能力，但还缺少一套固定 fixture 与统一验收流程，来证明整条链路可以从空 `knowledge/` 完整跑通。现在补上这一层，可以把产品核心假设与关键 gate 变成可重复验证的回归基线，再继续后续迭代。

## What Changes

- 新增一套 P0 端到端验收资产，包括一份稳定的 Markdown fixture、一个预设提问，以及从空 `knowledge/` 跑到 `approved` Note 再到 `answer` 的验收流程。
- 新增自动化端到端验收覆盖，使用测试注入的 fake agents / fake REPL，串起 `source ingest -> process -> understand -> discuss -> approve -> note compose -> lint -> approve -> index -> answer`。
- 在验收中显式校验两个关键 gate：没有讨论确认不能生成 Note；没有 QA passed 不能 approve Note。
- 新增人工验收说明，指导评审者手动走一遍 CLI 交互，确认 discussion REPL 与关键输出可接受。
- 本变更保持 P0 边界，不引入 PDF、自动采集、向量检索、Web UI 或数据库能力。

## Capabilities

### New Capabilities
- `end-to-end-acceptance`: 定义 P0 端到端验收 fixture、自动化验收与人工 CLI 验收步骤。

### Modified Capabilities
- None.

## Impact

- Affected layers: tests, fixtures, CLI acceptance guidance, lightweight test helpers.
- Existing domain schemas, storage layout, workflow gates, CLI commands, and agent contracts remain unchanged; the change verifies them together.
- No new runtime dependency and no change to production data format or external API.
