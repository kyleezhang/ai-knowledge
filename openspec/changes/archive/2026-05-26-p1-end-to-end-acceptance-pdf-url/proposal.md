## Why

P1 已把 PDF 与显式公开 URL 纳入手动导入范围，但当前端到端验收仍主要覆盖 P0 Markdown happy path，无法证明新输入类型能完整走通学习主链路。

本变更补齐 PDF / URL 的端到端验收用例，验证 P1 输入扩展不会破坏 Source -> discussion -> approved Note -> index -> answer 的主流程与边界约束。

## What Changes

- 增加稳定的 PDF 验收 fixture，用于从空 `knowledge/` 跑通 PDF happy path。
- 增加稳定的 URL 验收 fixture，优先使用本地 test server 或 mocked public page，避免默认验收依赖真实外网。
- 扩展端到端验收，分别覆盖 PDF 与 URL 从 ingest/process 到 answer 的完整闭环。
- 增加失败路径验收：URL fetch 失败、不支持的 URL content-type、PDF 抽取失败。
- 增加关键 gate 验收：未完成 discussion approval 不能生成 Note，未通过 QA/lint 不能 approve Note。
- 增加人工 CLI 验收说明，要求确认交互体验与来源追溯信息是否可接受。

Non-goals:

- 不新增 PDF / URL 之外的输入类型。
- 不引入爬虫、搜索扩展、自动采集、authenticated refetch 或 Candidate workflow。
- 不引入向量检索、数据库或 Web UI。
- 不要求默认验收调用真实 LLM、真实公网 URL 或私有资源。
- 不改变 `Note`、`Source`、`Index Entry` 的主对象语义。

Scope: P1。本变更只补齐 PDF / URL 手动导入能力的端到端验收与文档，不扩展 P2/P3 能力。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `end-to-end-acceptance`: 扩展验收要求，新增 PDF / URL happy path、失败路径、关键 gate 与人工 CLI 验收说明。

## Impact

- Affected layers:
  - tests: 新增或扩展端到端验收测试，覆盖 PDF 与 URL 主流程和失败路径。
  - fixtures: 新增稳定 PDF fixture 与 URL HTML/content-type fixtures。
  - CLI/workflows: 通过验收测试现有命令链路；仅在发现缺口时做最小修复。
  - docs/manual acceptance: 更新人工验收说明，覆盖 PDF / URL 与来源追溯检查点。
- API / data impact:
  - 不改变命令契约、对象 schema 或知识目录布局。
  - 验收应确认已有 processed artifacts、evidence locator、note lint、approved index 与 answer 规则仍成立。
- Dependencies:
  - 不新增运行时依赖；如测试需要 PDF fixture，应使用仓库内稳定 fixture 或现有 PDF 处理测试方式。
