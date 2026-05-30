## Context

Candidate 目前可以被采集、存储、查看、去重、过滤、评分并进入 `recommended` 状态，但还不能进入 Source 主流程。Issue 22 要求用户显式选择推荐 Candidate 后创建 Source，并建立 Candidate 与 Source 的双向引用。

该转换是 HITL gate：自动采集内容不能绕过用户选择直接变成 Source，更不能直接变成 Note 或 Index。转换后的 Source 仍必须从 `ingested` 开始，继续走 process、understand、discuss、approve、Note QA、index 等既有门槛。

## Goals / Non-Goals

**Goals:**

- 新增 Candidate select/convert workflow。
- 新增 `ai-knowledge candidate select <candidate_id>` CLI，支持 `--json`。
- 只允许 `recommended` Candidate 被选择。
- 转换成功创建 `Source.status = ingested`。
- Source 使用 `ingest_type = candidate_selected` 与 `origin.type = candidate`。
- Source 和 Candidate 建立双向引用。
- Candidate 最终状态变为 `converted`，写入 `converted_source_id`。
- 防止重复转换。
- 输出 next action：`ai-knowledge source process <source_id>`。

**Non-Goals:**

- 不自动执行 source process。
- 不生成 draft understanding、discussion summary、Note 或 Index Entry。
- 不允许 dismissed/new Candidate 进入 Source。
- 不实现批量 select。
- 不实现取消转换或回滚 converted Candidate。

## Decisions

### Decision 1: 转换 workflow 内部执行 selected -> converted

Workflow 在创建 Source 前先将 Candidate 从 `recommended` 更新为 `selected`，Source 创建成功后再更新为 `converted` 并写入 `converted_source_id`。

Rationale: 这匹配 issue 中的状态流转，同时在 partial failure 时能暴露 Candidate 已被选择但未完成转换的状态。

Alternative considered: 直接 recommended -> converted。实现更简单，但丢失 selected 中间语义。

### Decision 2: Candidate Source raw artifact 使用 URL markdown stub

Candidate 没有 raw 文件，转换为 Source 时应创建 raw original markdown，包含 Candidate title、summary、url、tags、source_type 等信息。Source content_type 使用 `link`，ingest_type 使用 `candidate_selected`。

Rationale: 现有 processing pipeline 需要 raw artifact；候选项本身是轻量 URL/摘要对象，转换后的 Source 应保留可处理的文本入口，同时不做远程抓取。

Alternative considered: 转换时抓取 URL 内容。那会引入网络处理与失败路径，属于 Source processing/URL ingest 范围，不应混入 select。

### Decision 3: Source id 基于 Candidate title 和 ingest_type

使用现有 `create_source_id` 和 slug，`ingest_type = candidate_selected`。若 id 冲突，使用 suffix 生成唯一 Source id。

Rationale: 与手动 ingest source id 规则一致，并保留 Candidate selected 来源信息。

Alternative considered: Source id 直接复用 Candidate id。会混淆对象类型和路径规则，不采用。

### Decision 4: 重复转换直接拒绝

若 Candidate 已有 `converted_source_id` 或状态为 `converted`，workflow 返回 invalid state，不再创建 Source。

Rationale: 同一 Candidate 只应对应一个 Source，防止重复学习对象。

Alternative considered: 允许多次转换生成多个 Source。会破坏双向映射并增加重复知识风险。

## Risks / Trade-offs

- [Risk] selected 状态后 Source 创建失败。→ Mitigation: workflow 返回 partial failure，Candidate 保持 selected，后续可由修复流程处理。
- [Risk] raw markdown stub 信息有限。→ Mitigation: 这是 Candidate 进入 Source 的最小可处理入口；后续 URL processing 可通过 explicit URL ingest 或 Source enrichment 单独扩展。
- [Risk] Candidate URL 指向非 markdown 内容。→ Mitigation: raw stub 记录 URL 和摘要，不直接抓取远程内容。

## Migration Plan

1. 增加 Candidate selected 状态更新 helper 或 workflow 内状态检查。
2. 新增 Candidate-to-Source raw markdown builder。
3. 新增 `select_candidate_workflow`。
4. 新增 CLI `candidate select <candidate_id>`。
5. 添加 workflow/CLI tests。
6. 验证 converted Source 仍需 process/understand/discuss/Note gates。

Rollback strategy: 删除 select workflow/CLI 与测试即可；已生成的 Source/Candidate 数据仍符合现有 schema。

## Open Questions

- Candidate 转 Source 后是否应立刻可 process？当前设计是 yes：写入 raw markdown stub，下一步 `source process`。
- selected 状态 partial failure 是否需要 retry 命令？本变更不实现，后续如果需要可加 `candidate convert` repair flow。

## Verification Strategy

- `openspec validate "candidate-select-convert-source" --strict`
- targeted Candidate select workflow/CLI tests
- source domain invariant tests for `candidate_selected`
- full `pnpm test`、`pnpm typecheck`、`pnpm lint`、`pnpm format:check`、`pnpm build`
