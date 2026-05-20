## Context

P0 主动学习链路已经具备 Markdown ingest、processing、draft_understanding 生成和 provider-based LLM client。下一步需要把 draft 变成围绕单个 Source 的多轮讨论：用户消息和 Agent 回复必须保存在 `discussion.jsonl`，结构化收敛结果必须回写 `source.discussion_summary`，并为后续 Source approval 提供明确依据。

该变更是 HITL 交互功能，跨越 storage、agents、workflow 和 CLI。它必须保持边界：Discussion Agent 只生成回复与 summary update 候选，不写文件、不改 Source 状态；workflow 负责 append log、状态流转与 summary 持久化；CLI 只负责 REPL 输入输出和内置命令分发。

## Goals / Non-Goals

**Goals:**

- 实现 `ai-knowledge source discuss <source_id>` 交互式 REPL。
- 支持前置状态 `understanding_ready | discussing`，首次讨论自动 `understanding_ready -> discussing`。
- 每轮追加 user/assistant 消息到 `discussion.jsonl`。
- 每轮调用 Discussion Agent，并将其结构化 `discussion_summary_update` 合并进 `source.discussion_summary`。
- 支持内置命令：`/summary`、`/draft`、`/status`、`/approve`、`/exit`、`/help`。
- `/approve` 只检查 ready 条件并提示下一步，不在本变更中执行 Issue 7 的 `approved_for_note` 状态流转。
- Discussion Agent 单轮失败时保持 `discussing`，写 `last_error.stage = discussion`。
- 测试通过 fake agent/client 覆盖 workflow 和 CLI command handling；真实 REPL 体验保留人工验收。

**Non-Goals:**

- 不实现 `source approve <source_id>` 的最终批准流程。
- 不生成 Note、不渲染 Markdown、不写 index。
- 不实现 Web UI。
- 不引入复杂会话数据库或后台任务系统。
- 不把 discussion_summary 当作 approved knowledge。

## Decisions

1. **REPL 壳与单轮 workflow 分离。**
   - Decision: `source discuss` CLI 提供 REPL 循环；每条普通用户消息调用一次 `discuss_source_workflow`。
   - Rationale: workflow 更容易测试，CLI 只处理输入输出和内置命令，不承载业务逻辑。
   - Alternatives considered: 把整个 REPL 做成一个长 workflow。放弃原因是交互输入和业务状态更新会耦合，测试困难。

2. **Discussion Agent 一次返回回复和 summary update。**
   - Decision: P0 使用一次 LLM 调用返回 `assistant_message` 与 `discussion_summary_update`。
   - Rationale: Issue 6 要求每轮 append 回复并更新 summary；一次结构化输出能保证两者来自同一轮上下文。
   - Alternatives considered: 先生成 reply，再单独 summarize。放弃原因是 P0 成本和复杂度更高，且需要处理两次 LLM 失败。

3. **summary update 由 workflow 补系统字段。**
   - Decision: Agent 只返回 `confirmed_points`、`open_questions`、`unresolved_issues`、`next_prompts`、`ready_for_approval`；workflow 递增 `summary_version`、设置 `last_updated_at` 和 `discussion_status`。
   - Rationale: 版本号、时间和状态是系统控制字段，不应由模型控制。
   - Alternatives considered: 让 Agent 输出完整 `discussion_summary`。放弃原因是会让模型伪造版本与时间，破坏状态治理。

4. **discussion 单轮失败不进入 `failed`。**
   - Decision: discussion agent 失败时 Source 保持 `discussing`，只写 `last_error.stage = discussion`。
   - Rationale: 用户可以继续输入或重试；一次 Agent 失败不应中断整个 Source 工作流。
   - Alternatives considered: transition 到 `failed`。放弃原因是不符合 Issue 6 acceptance criteria，也会破坏交互体验。

5. **`/approve` 不执行强制批准。**
   - Decision: `/approve` 只在 `ready_for_approval = true` 且 `confirmed_points` 非空时提示可运行后续 `source approve`；否则解释缺失条件。
   - Rationale: Issue 7 才负责最终 approval 状态流转；Issue 6 不应提前实现强制或绕过确认。

## Risks / Trade-offs

- [Risk] REPL 交互测试不稳定。→ Mitigation: 把业务逻辑放在单轮 workflow，CLI 使用可注入输入输出做 smoke tests，真实体验人工验收。
- [Risk] discussion_summary 被模型错误覆盖。→ Mitigation: Agent 输出候选 update，workflow 统一补 `summary_version`、`discussion_status`、`last_updated_at` 并持久化。
- [Risk] discussion.jsonl 写入与 Source 保存之间出现部分成功。→ Mitigation: P0 接受有限事务边界；append-only log 保留事实，workflow 返回错误并写 `last_error`。
- [Risk] `/approve` 被误解为最终批准。→ Mitigation: CLI 文案明确只是 ready 检查和下一步提示，最终状态流转留给 `source approve`。

## Migration Plan

- 已处于 `understanding_ready` 的 Source 可直接进入 `source discuss`。
- 已处于 `discussing` 的 Source 可继续讨论，复用已有 `discussion.jsonl` 和 `discussion_summary`。
- 不迁移历史 Note 或 Index。

## Open Questions

- P0 REPL 是否需要多行输入；建议先单行输入，后续按体验反馈扩展。
- `/approve` 是否自动调用 Issue 7 workflow；建议本变更不做，避免跨 issue 实现。

## Verification Strategy

- 运行 OpenSpec validation。
- 运行 `pnpm typecheck`、`pnpm test`、`pnpm lint`、`pnpm format:check`、`pnpm build`。
- Storage tests 覆盖 `discussion.jsonl` append/read。
- Agent tests 覆盖 Discussion Agent prompt、schema 和 fake LLM 输出。
- Workflow tests 覆盖首次状态流转、消息 append、summary update、agent failure 保持 discussing。
- CLI tests 覆盖内置命令和普通消息分发；人工验收真实 REPL 交互体验。
