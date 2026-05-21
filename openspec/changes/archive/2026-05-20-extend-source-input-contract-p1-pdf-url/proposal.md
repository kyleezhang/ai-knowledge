## Why

当前 `Source` 的主动输入契约只在 P0 明确覆盖 Markdown，但产品阶段规划已经把 PDF 放入 P1，且项目上下文已经确认 P1 还要支持“用户显式提供的 public URL”作为新的导入入口。如果不先把 PDF / URL 的 `Source` 输入契约统一到 spec 层，后续实现很容易在 CLI、schema、raw snapshot 与 processing 边界上各自演化，破坏 `Source -> processed artifacts -> draft_understanding` 的稳定接口。

## What Changes

- 将用户主动导入的 `Source` 输入契约从仅 Markdown 扩展为 Markdown、PDF、显式 public URL 三类，其中 PDF 与 URL 明确属于 P1 范围。
- 为 PDF 与 URL 明确 `ingest_type`、`content_type`、`origin.user_input_type`、`url`、raw snapshot 与标准化 `processing_artifacts` 约定。
- 新增 P1 CLI 输入路径 `ai-knowledge source ingest pdf <file>` 与 `ai-knowledge source ingest url <public_url>`，并要求 URL 在 ingest 阶段完成显式抓取快照后再进入既有 workflow。
- 保持 `process -> understand -> discuss -> approve -> note` 的后续 workflow 不变；下游继续只消费标准化 processed artifacts，而不是直接消费 PDF 二进制或 HTML。
- 明确 URL 范围仅限用户显式提供的公开页面；不包含 crawling、site discovery、search expansion、登录态页面、cookie/session 处理。
- 本变更不扩展 Candidate、自动采集、vector retrieval、Web UI 或 database 范围。

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `source-lifecycle`: 扩展 Source 的 P1 主动输入路径与对应 raw layout / CLI 契约。
- `source-processing`: 扩展 PDF / URL 的处理契约，并要求继续归一化为通用 processed artifacts。
- `draft-understanding`: 将理解阶段输入契约从 P0 Markdown-only 放宽到所有已标准化的 P1 Source 输入。

## Impact

- Affected layers: domain, storage, processing, workflows, CLI, tests.
- Affected contracts: `Source` enum values and ingest invariants, raw artifact persistence rules, processing inputs, ingest commands, and test fixtures.
- Likely implementation dependencies: a PDF text extraction utility and an HTML fetch/readability utility in P1; no change to the Note / Index truth model.
- Existing Markdown behavior remains backward-compatible; approved Note, QA gate, and retrieval priority rules do not change.
