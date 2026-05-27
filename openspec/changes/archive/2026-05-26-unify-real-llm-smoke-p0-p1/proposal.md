## Why

当前真实 LLM smoke 只覆盖 P0 Markdown 主链路，而 P1 PDF/URL 主要通过 fake-agent 自动化验收覆盖，导致“真实模型 + 完整功能”验证分散且容易遗漏。

本变更将 P0 与 P1 的真实 smoke 合并为唯一维护的本地 smoke case：一次显式运行即可用真实 LLM 验证 Markdown、PDF、URL 三类输入的关键学习闭环与来源追溯能力。

## What Changes

- 将现有 `pnpm test:smoke` 维护为唯一真实 LLM smoke 入口。
- 扩展 local smoke，使其在同一次运行中覆盖：
  - P0 Markdown happy path。
  - P1 PDF happy path。
  - P1 URL happy path。
- smoke 必须使用真实 LLM 完成 understand / discuss / note compose / answer 等 agent 环节。
- smoke 可对 PDF/URL 的外部不稳定点使用 deterministic fixture 或本地/mock 输入，但不得用 fake agents 替代真实 LLM agent 输出。
- smoke 继续本地显式触发，不并入默认 `pnpm test` 或 CI 阻塞链路。
- 更新文档与验收说明，明确只维护一个真实 LLM smoke case，以及它覆盖的能力和运行方式。

Non-goals:

- 不把真实 LLM smoke 纳入默认单元测试或 CI gate。
- 不要求真实公网 URL 作为 smoke 输入；URL 内容可以用 deterministic fixture 进入同一 CLI/workflow 链路。
- 不新增爬虫、自动采集、Candidate workflow、向量检索、数据库或 Web UI。
- 不改变 Source/Note/Index Entry schema 或 workflow gate 语义。
- 不移除 fake-agent 自动化测试；它们仍用于稳定回归，只是不再作为“真实 smoke”。

Scope: P1。该变更统一 P0/P1 本地真实 smoke 覆盖，不扩展 P2/P3 能力。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `end-to-end-acceptance`: 将本地真实 LLM smoke 从 P0-only 扩展为唯一的 P0+P1 综合 smoke，明确真实 LLM、单入口、覆盖范围与默认测试边界。

## Impact

- Affected layers:
  - smoke: 扩展 `src/smoke/local-llm-smoke.ts`，一次运行覆盖 Markdown/PDF/URL。
  - CLI/workflows: 通过 smoke 调用现有命令链路；仅在发现缺口时做最小修复。
  - tests: 更新 smoke 相关单元测试，验证 skip、输出摘要、P0/P1 编排与错误信息。
  - docs/manual acceptance: 更新 P1/P0 验收说明，避免维护多个真实 LLM smoke 入口。
- API / command impact:
  - `pnpm test:smoke` 仍是唯一真实 smoke 命令。
  - 输出应报告每个路径的 `source_id`、`note_id` 与 answer summary，便于调试。
- Dependencies:
  - 不新增运行时依赖。
  - 继续依赖 `DEEPSEEK_API_KEY` 或当前 LLM provider 环境配置；缺失时 skip。
