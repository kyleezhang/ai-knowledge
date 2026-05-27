## Context

当前 `end-to-end-acceptance` capability 已覆盖 P0 Markdown 验收：从空 `knowledge/` 开始，使用 fake agents 跑通 ingest、process、understand、discuss、source approve、note compose、note lint、note approve、note index 与 answer，并验证关键 gate。

P1 已支持手动 PDF 与显式公开 URL 输入，且 `source-processing` 与 `evidence-locator` 已要求 PDF/URL 产生 normalized artifacts 与 processed segment locator。下一步需要把这些能力纳入端到端验收，证明输入扩展不会破坏知识主链路，也不会让失败路径或 gate 变得含糊。

## Goals / Non-Goals

**Goals:**

- 增加 PDF happy path 端到端验收，从空 `knowledge/` 跑到 approved Note、index entry 与 answer。
- 增加 URL happy path 端到端验收，使用本地 fixture 或 mocked fetch，避免默认测试依赖真实公网。
- 在验收中确认 PDF/URL 都产生 `processed/clean_text.md`、`processed/segments.json`、`processed/metadata.json` 与可追溯 evidence locator。
- 覆盖 P1 失败路径：URL fetch 失败、不支持的网页 `content-type`、PDF 抽取失败。
- 复用并扩展 P0 gate 验收：没有 discussion approval 不能 compose Note，没有 QA passed 不能 approve Note。
- 提供人工 CLI 验收说明，明确 PDF/URL 的命令链路、检查点、来源追溯与通过标准。

**Non-Goals:**

- 不让默认自动化验收依赖真实 LLM、真实公网 URL 或私有资源。
- 不新增爬虫、自动采集、Candidate workflow、向量检索、数据库或 Web UI。
- 不改变 Source/Note/Index Entry schema 或 workflow 状态机语义。
- 不要求测试覆盖真实 PDF parser 的全部边界；PDF happy path fixture 只需要稳定抽取文本。
- 不把 raw PDF/HTML 作为 Note 或 answer 的正式证据来源。

## Decisions

### Decision 1: 自动化验收继续使用 fake agents / injected processors

PDF 与 URL happy path 验收默认通过测试注入 fake understand/discuss/note/answer agent，并可在必要时注入 deterministic PDF processor 或 URL fetcher。

Rationale: 默认 `pnpm test` 必须稳定、快速、离线，不应受 LLM 输出、网络、远程页面变化或 PDF parser 波动影响。

Alternative considered: 使用真实 LLM 与真实公网 URL 做默认验收。该方案更接近真实使用，但会引入凭证、网络、成本与非确定性，不适合作为默认 gate。

### Decision 2: PDF fixture 与 URL fixture 都从 CLI/workflow 边界验证主链路

验收应尽量走现有 CLI 或 workflow 入口，而不是直接构造最终 Note/Index。每条 happy path 至少验证：Source 状态推进、processed artifacts、draft understanding、discussion approval、draft Note、lint passed、approved Note、index entry、answer 引用 approved Note。

Rationale: Issue 17 的目标是端到端验收，而不是 processor 单测。测试应覆盖跨层组合行为，同时保持 fake agent 输出确定。

Alternative considered: 只新增 processor 单测。该方案不能证明 PDF/URL 输入能完整进入 knowledge 主链路，因此不采用。

### Decision 3: URL 验收使用 mocked public page 或本地 test server

URL happy path 通过 deterministic HTML 内容与 content-type 返回值模拟公开网页。失败路径分别覆盖 fetch 抛错和 unsupported content-type。

Rationale: 这样可以验证 URL ingest/process 行为和错误输出，同时避免真实网络依赖。

Alternative considered: 固定一个真实公共 URL。该方案会受网络、页面内容和 headers 变化影响，因此不适合作为默认验收。

### Decision 4: 人工验收文档补充而非替代自动化验收

新增或扩展 manual acceptance 文档，列出 PDF/URL 命令、关键检查点、失败路径可选检查、来源追溯检查，以及真实 LLM smoke 的边界。

Rationale: P1 包含 CLI 交互体验和来源追溯可接受性，需要人工确认；但自动化测试仍承担主要回归责任。

Alternative considered: 仅保留人工验收。该方案回归成本高，也无法在 CI/本地默认测试中防止主链路退化。

## Risks / Trade-offs

- [Risk] 真实 PDF fixture 可能因 parser 版本或平台差异导致文本抽取不稳定。→ Mitigation: 使用小型、简单、仓库内固定 fixture；如仍不稳定，happy path 可注入 deterministic processor，同时保留 PDF processor 单测覆盖抽取逻辑。
- [Risk] URL content-type 与 fetch 失败路径被现有接口抽象隐藏。→ Mitigation: 在 ingest URL workflow/CLI 的现有 fetch 注入点覆盖 success、fetch error 与 unsupported content-type 行为。
- [Risk] 端到端测试过长或难维护。→ Mitigation: 复用测试 helper，把 Markdown/PDF/URL 的公共链路抽成测试内 helper，不引入生产抽象。
- [Risk] 验收误用 raw Source 作为 answer evidence。→ Mitigation: 在 answer fake agent 输入断言只收到 approved Notes，并检查 Note 内 source refs / evidence locator。
- [Risk] 人工文档与实际命令漂移。→ Mitigation: 文档使用现有 CLI 命令名，并在自动化测试覆盖核心命令链路。

## Migration Plan

1. 新增 PDF/URL 验收 fixtures 或测试内 deterministic fixtures。
2. 扩展端到端验收测试 helper，支持 PDF 与 URL 输入类型。
3. 新增 PDF happy path 验收。
4. 新增 URL happy path 验收。
5. 新增 URL fetch failure、unsupported content-type、PDF extraction failure 验收。
6. 扩展或新增人工 CLI 验收文档。

Rollback strategy: 本变更主要新增测试与文档；若某个真实 fixture 不稳定，可回退为 deterministic injected fixture，不影响生产对象 schema 或命令契约。

## Open Questions

- 是否已有足够稳定的 PDF fixture 可直接纳入仓库，还是应在测试中生成/注入 deterministic PDF processing result？实现阶段应优先选择维护成本最低且稳定的方案。
- 人工验收文档应扩展现有 `tests/p0-end-to-end-acceptance.manual.md`，还是新增 `tests/p1-end-to-end-acceptance.manual.md`？当前倾向新增 P1 文档，避免 P0 文档膨胀。

## Verification Strategy

- 运行 OpenSpec validation，确保 delta spec 可解析。
- 运行 targeted Vitest 端到端验收测试和相关 PDF/URL workflow/CLI 测试。
- 运行完整 `pnpm test`、`pnpm typecheck`、`pnpm lint`、`pnpm format:check`、`pnpm build`。
- 人工验收文档应列出命令与检查点，但不要求默认自动化执行真实 LLM 或公网访问。
