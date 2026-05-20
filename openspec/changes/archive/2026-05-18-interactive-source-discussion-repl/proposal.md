## Why

Issue 6 要把 `draft_understanding` 变成真正可与用户多轮讨论的交互流程，而不是停留在一次性草稿生成。没有讨论 REPL，系统无法维护原始讨论消息和结构化 `discussion_summary`，也无法为后续 Source approval 提供收敛依据。

## What Changes

- 实现 `ai-knowledge source discuss <source_id>` 交互式 REPL。
- 前置状态支持 `understanding_ready | discussing`。
- 首次讨论自动执行 `understanding_ready -> discussing`。
- 每轮用户消息 append 到 `discussion.jsonl`。
- 每轮调用 Discussion Agent，Agent 回复 append 到 `discussion.jsonl`。
- 每轮更新 `source.discussion_summary`，维护 `summary_version`、`confirmed_points`、`open_questions`、`unresolved_issues`、`next_prompts`、`ready_for_approval`、`discussion_status`、`last_updated_at`。
- 支持内置命令：`/summary`、`/draft`、`/status`、`/approve`、`/exit`、`/help`。
- `/approve` 不允许强制确认；必须满足 `ready_for_approval = true` 且 `confirmed_points` 非空，具体 approval 进入 Issue 7。
- Discussion Agent 单轮失败时保持 `discussing`，写 `last_error.stage = discussion`，不把 Source 转为 `failed`。
- 非目标：不实现 Source approval 的最终状态流转、不生成 Note、不写 index、不引入 Web UI。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `discussion-convergence`: 细化交互式 discussion REPL、discussion.jsonl append、Discussion Agent 输出、summary 更新、内置命令和单轮失败语义。

## Impact

- Affected layers: domain, storage, agents, workflows, CLI, tests。
- Domain: 新增 discussion message / Discussion Agent output schema，复用 Source state machine。
- Storage: 实现或完善 `discussion.jsonl` append/read。
- Agents: 新增 `discussion-agent`，使用 `discussion-reply.md` prompt 和 `LlmClient.generate_json`。
- Workflows: 新增 `discuss_source_workflow`，负责单轮消息 append、agent 调用、summary 更新、状态流转和失败记录。
- CLI: 新增交互式 REPL 壳，处理内置命令和逐轮用户输入。
- Tests: 覆盖 domain schema、discussion log、agent、workflow、CLI command handling；真实 REPL 体验需人工验收。
