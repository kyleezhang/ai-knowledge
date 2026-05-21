## 1. 验收资产准备

- [x] 1.1 新增一份稳定的 Markdown fixture 与预设问题，覆盖从学习材料到问答的 P0 主链路输入。
- [x] 1.2 确定验收中使用的 fake `understand`、fake `discuss`、fake `compose_note`、fake `answer` 与 `repl_input` 方案，保证不依赖真实 LLM。

## 2. 自动化端到端验收

- [x] 2.1 新增从空临时工作目录启动的 CLI 端到端验收用例，串起 `source ingest -> process -> understand -> discuss -> approve -> note compose -> lint -> approve -> index -> answer`。
- [x] 2.2 在验收用例中断言关键文件与状态产物，包括 processed artifacts、discussion summary、`note.json`、`note.md`、approved Note 与 index entry。
- [x] 2.3 在验收用例中加入未执行 `source approve` 即尝试 `note compose` 的失败校验，确认未讨论确认不能生成 Note。
- [x] 2.4 在验收用例中加入 QA 未通过即尝试 `note approve` 的失败校验，确认未 QA passed 不能 approve Note。
- [x] 2.5 在最终 `answer` 验收中断言回答引用 approved Notes，且不回退到 raw Sources。

## 3. 人工验收说明与验证

- [x] 3.1 编写 P0 端到端人工验收步骤，覆盖 fixture 导入、discussion REPL、approve、note、index 与 answer 命令。
- [x] 3.2 在人工验收说明中列出关键检查点与通过标准，明确需要确认 discussion REPL 交互体验可接受。

## 4. 质量校验

- [x] 4.1 运行与端到端验收相关的测试并修正失败项。
- [x] 4.2 运行 OpenSpec validation、typecheck、lint / format / build 所需校验，确认该 change 可进入实现阶段。
