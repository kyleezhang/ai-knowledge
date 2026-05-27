## Context

当前真实 smoke 入口是 `pnpm test:smoke`，通过 `scripts/local-llm-smoke.mjs` 调用 `src/smoke/local-llm-smoke.ts`。它在配置 `DEEPSEEK_API_KEY` 时使用真实 LLM 跑通 P0 Markdown 主链路；缺少 key 时 skip。

P1 PDF/URL 已有 fake-agent 端到端验收，但用户希望不要分别维护 P0 smoke 与 P1 smoke，而是保留一个完整真实 LLM smoke case，覆盖当前版本全部关键输入能力。该 smoke 必须继续保持本地显式触发，避免默认测试和 CI 依赖真实模型、token 成本或网络波动。

## Goals / Non-Goals

**Goals:**

- 保留 `pnpm test:smoke` 作为唯一真实 LLM smoke 入口。
- 一次 smoke 运行覆盖 Markdown、PDF、URL 三类输入的 happy path。
- 对每类输入都验证：ingest、process、understand、discuss/source approval、note compose、note lint、note approve、note index、answer。
- understand、discuss、note compose、answer 必须使用真实 LLM agent，不使用 fake agents 替代。
- 继续在缺少 LLM provider key 时 skip，并输出清晰 skip reason。
- smoke 输出每条路径的 `source_id`、`note_id` 与 answer summary，便于定位失败。

**Non-Goals:**

- 不把真实 LLM smoke 并入 `pnpm test` 或默认 CI gate。
- 不要求 smoke 使用真实公网 URL；URL 输入可以由本地 deterministic fixture 经 CLI/workflow 链路进入。
- 不要求 smoke 使用真实复杂 PDF；可以使用稳定小型 fixture，但处理链路必须经过 PDF ingest/process。
- 不替代 fake-agent 自动化验收；常规测试仍使用 fake agents 保持稳定。
- 不改变知识对象 schema、状态机、QA gate、indexing 或 answer grounding 语义。

## Decisions

### Decision 1: `pnpm test:smoke` 是唯一真实 smoke 入口

继续使用现有 `test:smoke` 脚本，不新增 `test:smoke:p1` 或类似入口。实现上扩展 `run_local_llm_smoke_test`，让它顺序跑 Markdown、PDF、URL 三条路径，并汇总结果。

Rationale: 用户明确希望“只维护一个 smoke case”。保留现有命令可以减少使用成本和文档分叉。

Alternative considered: 新增 P1 smoke 脚本并保留 P0 smoke。该方案与目标相反，会继续造成重复维护。

### Decision 2: 每条输入路径复用同一 smoke flow helper

在 smoke 实现内部抽取测试专用 helper，统一执行 source/note/answer 主链路。每条路径只提供 ingest/process 输入与确认语句。该 helper 属于 smoke 层，不抽成生产通用 workflow。

Rationale: 三条路径的主链路一致，复用可以减少 drift；但不应为测试编排引入生产抽象。

Alternative considered: 复制三份命令序列。实现最直接，但后续 gate 或输出检查变化时容易漏改。

### Decision 3: URL/PDF 输入外部不稳定点可以 deterministic，LLM 环节必须真实

URL 可以通过 smoke 内部写入/提供 deterministic HTML fixture，PDF 可以使用仓库内稳定 PDF fixture 或可稳定处理的 fixture。真实 LLM 必须用于 understand、discuss、compose、answer，不允许 fake agent output。

Rationale: smoke 的目标是验证真实模型与主链路集成，不是验证公网或复杂 PDF 生态。网络和 fixture 不稳定会降低 smoke 信噪比。

Alternative considered: URL 使用真实公网，PDF 使用复杂真实材料。更接近真实使用，但会引入外部波动，不适合 smoke。

### Decision 4: Smoke 断言结构和状态，不要求逐字稳定输出

Smoke 应断言状态推进、标准 processed artifacts、Note lint passed、approved Note、index entry、answer heading / cited note 等结构性结果。LLM 文本只检查非空或包含必要结构，不做逐字匹配。

Rationale: 真实 LLM 输出天然有波动；smoke 应检测集成故障，而不是做 brittle snapshot。

Alternative considered: 固定逐字回答。会让 smoke 因合理模型波动频繁失败。

## Risks / Trade-offs

- [Risk] 三条路径都调用真实 LLM，运行时间和 token 成本增加。→ Mitigation: 仍本地显式触发；使用小 fixture 和简短讨论输入；输出清晰路径进度。
- [Risk] 某一路径失败导致整次 smoke 失败，定位成本增加。→ Mitigation: 汇总每条路径的 source/note/answer 信息，并在错误中包含当前 path label、workdir、source_id、note_id。
- [Risk] URL/PDF deterministic 输入可能被误解为不验证真实处理。→ Mitigation: 明确 smoke 目标是真实 LLM + 主链路；processor 真实边界仍由自动化测试覆盖。
- [Risk] LLM 输出偶发不符合 schema。→ Mitigation: 依赖现有 agent schema retry/validation；smoke 失败时保留 `--keep-workdir` 便于排查。
- [Risk] 环境变量配置问题导致用户误以为通过。→ Mitigation: 缺 key 时明确输出 skipped，而非 passed。

## Migration Plan

1. 扩展 smoke result 类型，支持多路径结果汇总。
2. 抽取 smoke 内部 flow helper，统一执行 CLI 命令链路并保留真实 LLM agents。
3. 将现有 Markdown smoke 改为路径之一。
4. 添加 PDF smoke path，使用稳定 PDF fixture 并验证 PDF processed artifacts / locator / approved answer。
5. 添加 URL smoke path，使用 deterministic URL HTML 输入并验证 frozen snapshot / URL locator / approved answer。
6. 更新 `scripts/local-llm-smoke.mjs` 输出多路径摘要。
7. 更新 smoke 单元测试和人工验收文档。

Rollback strategy: 若 P1 path 引入不可接受的运行成本，可保留单入口但允许通过显式参数仅运行 Markdown；默认仍应覆盖 P0+P1，除非另起 OpenSpec 调整。

## Open Questions

- URL smoke 是否通过 CLI 注入 `fetch_html` 还是在 smoke 内调用 workflow 更直接？当前倾向继续通过 `create_program` 注入 fetcher，保持 CLI 命令链路。
- PDF smoke 是否使用现有 fake PDF 文件配合真实 processor，还是新增可解析 PDF fixture？实现阶段应优先选择稳定且不新增依赖的方案；如果真实解析不稳定，可在自动化测试覆盖 parser，smoke 使用稳定 fixture。

## Verification Strategy

- OpenSpec validation。
- 更新 smoke 单元测试，覆盖 skip、多路径汇总和输出格式。
- 运行 targeted smoke tests（不调用真实 provider）。
- 运行 `pnpm test`、`pnpm typecheck`、`pnpm lint`、`pnpm format:check`、`pnpm build`。
- 如本地有 `DEEPSEEK_API_KEY`，可显式运行 `pnpm test:smoke -- --keep-workdir` 验证真实 LLM smoke。
