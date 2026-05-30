## Why

Candidate 采集、存储、推荐已经就绪，但推荐候选还不能由用户显式选择进入 Source 主流程。没有 `Candidate -> Source` 转换，自动发现链路仍然停留在候选池，无法进入后续处理、理解、讨论、Note 和问答闭环。

本变更实现用户选中 recommended Candidate 并转换为 Source，同时建立 Candidate 与 Source 的双向引用，确保自动采集内容必须经过用户选择才能进入主学习流程。

## What Changes

- 新增 `ai-knowledge candidate select <candidate_id>`，支持 `--json`。
- 只允许 `status = recommended` 的 Candidate 被选中。
- Candidate 状态流转：`recommended -> selected -> converted`。
- 创建 `Source.status = ingested`。
- Source 使用：
  - `ingest_type = candidate_selected`
  - `origin.type = candidate`
  - `origin.candidate_id = <candidate_id>`
  - `origin_candidate_id = <candidate_id>`
- 写入 `Candidate.converted_source_id = <source_id>`。
- 转换后返回 next action：`ai-knowledge source process <source_id>`。
- 防止同一 Candidate 重复转换。

Non-goals:

- 不实现 Candidate 自动选择。
- 不允许 dismissed/new/selected/converted Candidate 直接转换。
- 不跳过 Source processing、understanding、discussion、Note QA 或 indexing gate。
- 不调用 LLM，不生成 draft understanding 或 Note。
- 不写入 main index。

Scope: P2 Candidate -> Source HITL 入口。该变更只负责显式选择推荐 Candidate 并创建 ingested Source。

## Capabilities

### New Capabilities

- `candidate-selection`: 定义 Candidate select、Candidate -> Source 转换、双向引用、状态流转、CLI 与 gate 边界。

### Modified Capabilities

- `candidate-domain`: 明确 selected/converted 状态和 `converted_source_id` 的转换语义。
- `candidate-storage`: Candidate repository update 能力用于写入 selected/converted 状态与 `converted_source_id`。
- `source-lifecycle`: 增加由 Candidate 创建 Source 的 lifecycle 要求。

## Impact

- Affected layers:
  - workflow: 新增 Candidate select/convert workflow。
  - storage: 复用 Candidate repository update 与 Source repository create。
  - CLI: 新增 `candidate select <candidate_id>`。
  - tests: 覆盖成功转换、非法状态、重复转换、双向引用、next action、JSON 输出、gate 隔离。
- API / data impact:
  - 新增由 Candidate 创建的 Source，raw material 需要从 Candidate URL/summary 构造初始 raw artifact。
  - Candidate JSON 更新为 `converted` 并记录 `converted_source_id`。
  - Source JSON 记录 Candidate origin。
- Dependencies:
  - 不新增运行时依赖。
