## 1. Domain and Agent Schemas

- [x] 1.1 定义 `GroundedAnswerSchema`，包含 `conclusion`、`cited_notes`、`unconfirmed_materials`、`limitations`。
- [x] 1.2 定义 cited note item schema，包含 `note_id`、`title`、`relevant_points`。
- [x] 1.3 P0 `unconfirmed_materials` schema 保持数组，workflow/agent 测试中应为空数组。
- [x] 1.4 添加 schema tests，覆盖合法 grounded answer、缺字段、cited_notes 类型错误。

## 2. Retrieval

- [x] 2.1 实现 `retrieve_approved_notes(question, top_k)`，只读取 approved Index Entries。
- [x] 2.2 keyword/metadata matching 覆盖 title、summary、keywords、tags。
- [x] 2.3 retrieval 返回按匹配分数排序的 top-k entries。
- [x] 2.4 缺失或无法加载的 Note 应跳过，不把 Index Entry 当知识真相。
- [x] 2.5 添加 retrieval tests，覆盖 approved-only、top-k、no match、missing Note skip。

## 3. Answer Agent

- [x] 3.1 实现 `answer-agent.ts`，加载 `answer-grounded.md` prompt。
- [x] 3.2 定义 `AnswerAgentInput`，包含 question 和 approved_notes。
- [x] 3.3 调用 `LlmClient.generate_json`，使用 `GroundedAnswerSchema` 校验输出。
- [x] 3.4 组织结构化 user prompt，明确 P0 只基于 approved Notes，不 fallback Source。
- [x] 3.5 添加 answer-agent tests，使用 fake `LlmClient` 覆盖 prompt、成功输出和 schema failure。

## 4. Workflow

- [x] 4.1 实现 `answer_question_workflow`，读取 main index 并执行 retrieval。
- [x] 4.2 没有命中时不调用 Answer Agent，返回明确无相关已确认知识的 answer。
- [x] 4.3 命中时加载 approved Notes，并调用 Answer Agent。
- [x] 4.4 workflow 确保 P0 不读取 Source、draft_understanding 或 discussion_summary 作为 fallback。
- [x] 4.5 支持 `top_k` 参数并设置合理默认值。
- [x] 4.6 添加 workflow tests，覆盖 no hit、hit approved note、top-k、agent failure、skip invalid index target。

## 5. CLI

- [x] 5.1 新增 `ai-knowledge answer "<question>"` 命令。
- [x] 5.2 支持 `--top-k <n>`。
- [x] 5.3 支持 `--json` 输出 workflow result。
- [x] 5.4 人类可读输出展示综合结论、引用 Notes、不足与边界。
- [x] 5.5 添加 CLI tests，覆盖 no hit、hit、top-k、JSON 输出。

## 6. Verification

- [x] 6.1 运行 OpenSpec 校验，确认 `answer-approved-notes` change 有效。
- [x] 6.2 运行 TypeScript typecheck。
- [x] 6.3 运行 Vitest 测试套件。
- [x] 6.4 运行 ESLint 和 Prettier 检查。
- [x] 6.5 运行 build。
- [x] 6.6 使用 fixture 跑通 `note index -> answer`，确认答案引用 approved Note。
