## 1. Domain and Schemas

- [x] 1.1 定义 `DiscussionMessageSchema`，包含 `role`、`content`、`created_at` 和可选 metadata。
- [x] 1.2 定义 `DiscussionAgentOutputSchema`，包含 `assistant_message` 和 `discussion_summary_update`。
- [x] 1.3 定义 `DiscussionSummaryUpdateSchema`，只包含 agent 候选字段，不包含 `summary_version`、`discussion_status`、`last_updated_at`。
- [x] 1.4 添加 domain/agent schema tests，覆盖合法消息、非法 role、summary update 缺字段和类型错误。

## 2. Storage Discussion Log

- [x] 2.1 实现 `discussion-log.ts`，支持 append 单条 discussion message 到 `discussion.jsonl`。
- [x] 2.2 实现读取 `discussion.jsonl`，空文件返回 `[]`，任意行 JSON parse 失败时报错。
- [x] 2.3 确保 discussion log 路径通过 storage path helper 解析，不手写 `knowledge/` 路径。
- [x] 2.4 添加 storage tests，覆盖 append 顺序、空文件读取、坏 JSONL 报错。

## 3. Discussion Agent

- [x] 3.1 实现 `src/agents/discussion-agent.ts`，加载 `discussion-reply.md` prompt。
- [x] 3.2 定义 `DiscussionAgentInput`，包含 Source title、draft_understanding、current discussion_summary、recent messages、user_message、可选 relevant_segments、related_notes 和 `input_truncated`。
- [x] 3.3 调用 `LlmClient.generate_json`，使用 `DiscussionAgentOutputSchema` 校验输出。
- [x] 3.4 组织结构化 user prompt，清晰区分 draft、summary、recent messages 和用户本轮输入。
- [x] 3.5 添加 discussion-agent tests，使用 fake `LlmClient` 覆盖成功输出、prompt 组织和 schema failure。

## 4. Discussion Workflow

- [x] 4.1 实现 `discuss_source_workflow`，前置状态支持 `understanding_ready | discussing`。
- [x] 4.2 首次讨论从 `understanding_ready` 通过状态机 transition 到 `discussing`。
- [x] 4.3 每轮先 append user message 到 `discussion.jsonl`。
- [x] 4.4 调用 Discussion Agent 后 append assistant message 到 `discussion.jsonl`。
- [x] 4.5 workflow 合并 `discussion_summary_update`，递增 `summary_version`，设置 `last_updated_at` 与 `discussion_status`。
- [x] 4.6 成功路径保存 Source，并清除上一轮 `last_error`。
- [x] 4.7 Discussion Agent 单轮失败时保持 Source 为 `discussing`，写入 `last_error.stage = discussion`。
- [x] 4.8 添加 workflow tests，覆盖首次流转、继续讨论、消息 append、summary 更新、agent failure 保持 discussing。

## 5. CLI REPL

- [x] 5.1 新增 `ai-knowledge source discuss <source_id>` 命令，启动交互式 REPL。
- [x] 5.2 REPL 启动时展示 Source 基本信息、draft 摘要和可用命令。
- [x] 5.3 普通输入调用 `discuss_source_workflow` 并显示 assistant reply。
- [x] 5.4 实现 `/summary`、`/draft`、`/status`、`/help`、`/exit` 内置命令，不调用 Discussion Agent。
- [x] 5.5 实现 `/approve` ready 检查：未 ready 时拒绝并说明原因，ready 且 confirmed_points 非空时提示后续 `source approve`。
- [x] 5.6 为 CLI REPL 提供可注入 input/output 以便测试，不依赖真实 stdin。
- [x] 5.7 添加 CLI tests，覆盖内置命令、普通消息分发、`/approve` ready 检查和 `/exit`。

## 6. Verification

- [x] 6.1 运行 OpenSpec 校验，确认 `interactive-source-discussion-repl` change 有效。
- [x] 6.2 运行 TypeScript typecheck。
- [x] 6.3 运行 Vitest 测试套件。
- [x] 6.4 运行 ESLint 和 Prettier 检查。
- [x] 6.5 运行 build。
- [x] 6.6 使用 fake agent 跑通 `ingest -> process -> understand -> discuss one turn`，确认 Source 为 `discussing`、discussion.jsonl 有 user/assistant 两条消息、summary_version 增加。
- [x] 6.7 人工验收真实 REPL：普通消息、内置命令、退出行为可用。
