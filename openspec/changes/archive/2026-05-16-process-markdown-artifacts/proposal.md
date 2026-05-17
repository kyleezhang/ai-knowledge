## Why

Issue 3 要把已导入的 Markdown Source 转换为稳定的 processed artifacts，作为后续 `draft_understanding` 的必要输入。当前 `source-processing` 已定义处理阶段边界，但还缺少 P0 Markdown 三件套、状态流转、失败记录和 CLI 契约的可实施细化。

## What Changes

- 实现 `ai-knowledge source process <source_id>` 的 P0 Markdown 处理能力。
- 读取 Source 目录下的 `raw/original.md`，生成固定 processed artifacts：
  - `processed/clean_text.md`
  - `processed/segments.json`
  - `processed/metadata.json`
- 在 `source.json.processing_artifacts` 中登记相对 Source 目录的 artifact 路径。
- 强制处理前置状态为 `ingested`，成功状态流转为 `ingested -> processing -> processed`。
- 处理失败时保留 raw material，将 Source 转为 `failed`，并写入 `last_error.stage = processing`。
- CLI 成功后输出 next action：`ai-knowledge source understand <source_id>`，并支持 `--json`。
- 非目标：不加入 PDF、自动采集、Candidate 工作流、向量检索、Web UI 或数据库能力。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `source-processing`: 细化 P0 Markdown processing 的 artifacts、状态流转、失败语义和 CLI 输出契约。

## Impact

- Affected layers: domain, storage, processing, workflows, CLI, tests。
- Domain: 校验 `processing_artifacts`、`last_error` 与 Source 状态机约束。
- Storage: 通过现有 path/artifact helper 读写 `raw/original.md` 与 processed artifacts，不手写 `knowledge/` 路径。
- Processing: 增加 Markdown processor，将 Markdown 标准化为 clean text、segments 和 metadata。
- Workflow: 增加或完善 `process_source_workflow`，负责状态流转、artifact 登记、错误转换和 next action。
- CLI: 增加 `source process <source_id>` 命令及人类可读 / `--json` 输出。
- Tests: 覆盖 processor、artifact 写入、workflow 状态流转、失败路径和 CLI smoke 行为。
