## 1. Discussion JSON 稳定性修复

- [x] 1.1 在 `generate_json` 中增加受限 JSON 恢复逻辑，支持单个 fenced JSON block 或单个顶层 JSON object 的提取后再执行 `JSON.parse`。
- [x] 1.2 保持 discussion 结构化输出的 Zod schema 为硬门槛，并补充 recovery 成功 / 失败的错误分类测试。

## 2. Approval 摩擦修复

- [x] 2.1 调整 `source approve` workflow，使用户显式 approve 且 `confirmed_points` 非空时可推进到 `approved_for_note`，不再把 `ready_for_approval` 作为硬门槛。
- [x] 2.2 调整 discussion REPL `/approve` 提示，明确区分缺少 `confirmed_points`、模型尚未建议 ready、以及可显式确认推进三种情况。

## 3. 回归测试与验证

- [x] 3.1 新增 discussion / LLM client 测试，覆盖 fenced JSON、可恢复 JSON object、不可恢复 JSON 三类输出。
- [x] 3.2 新增 workflow / CLI 测试，覆盖用户显式 approve 成功、confirmed_points 为空仍拒绝、以及更清晰的 approval 阻塞提示。
- [x] 3.3 运行 OpenSpec validation、typecheck、Vitest、lint / format check 与 build，确认短期修复可进入实现阶段。
}}]}】【：】【“】【functions.Bash to=commentary ￣色json  天天中彩票APPcommand=