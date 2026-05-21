## Why

当前端到端验收只覆盖 fake agents / fake REPL 路径，无法发现真实 LLM 集成中的协议漂移、凭证配置、模型输出波动或 prompt 与 provider 真实交互问题。为了在本地显式跑通一条低频但高价值的真实集成检查，需要新增一条使用真实 `DEEPSEEK_API_KEY` 的 smoke test，但它不应进入默认 `pnpm test` 或 CI 阻塞链路。

## What Changes

- 新增一条本地显式触发的 smoke test，使用真实 `DEEPSEEK_API_KEY` 和固定 fixture 运行一条完整的 Source 学习主链路检查。
- 将 smoke test 限定为本地 / 手动 / 预发布使用：默认不并入 `pnpm test`，CI 不自动执行，未配置 `DEEPSEEK_API_KEY` 时默认跳过或拒绝执行。
- smoke test 只校验关键状态推进与关键落盘产物，例如 `processed artifacts`、`draft_understanding`、discussion summary、approval、Note 草稿或等价的关键控制面，而不要求逐字稳定输出。
- 为 smoke test 增加独立命令或脚本入口，例如 `pnpm test:smoke`，并为其提供明确的前置条件、跳过语义和人工使用说明。
- 本变更不改变默认单元测试策略，不把真实 LLM 依赖引入常规 `pnpm test`，也不放宽正式 workflow 的结构化校验边界。

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `end-to-end-acceptance`: 增加一条本地显式触发、使用真实 LLM 的 smoke test 路径，但保持现有 fake-agent 自动化验收为默认基线。
- `llm-client-prompt-loading`: 为本地 smoke test 约定真实 provider 凭证前置条件与跳过行为，不改变默认无网络测试策略。

## Impact

- Affected layers: scripts, tests, agents config integration, CLI acceptance guidance.
- Affected workflows: source ingest / process / understand / discuss / approve / note compose 的本地真实集成验证路径。
- No change to production object schemas, Note truth model, or default CI / unit test contract.
- Main tradeoff: smoke test 会引入本地成本、波动和偶发不稳定，因此只作为显式触发的非阻塞验证手段。
