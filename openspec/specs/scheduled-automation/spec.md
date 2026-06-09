# Scheduled Automation Specification

## Purpose

This capability defines local schedules, scheduler tick behavior, scheduled Candidate collection, and safe auto-advancement while preserving Candidate, Source, Note, and Index workflow gates.

## Requirements

### Requirement: Local schedules are persisted automation metadata
系统 SHALL 将定时自动化规则表示为本地持久化的 `LocalSchedule` 对象。Schedule MUST 包含 `schedule_id`、`type`、`status`、`rule`、`policy`、`created_at`、`updated_at`、`last_run_at`、`next_run_at` 和最近运行摘要。Schedule MUST 只保存安全配置、对象 id、provider 名称和选项，不得保存原始资料正文或凭证。

#### Scenario: Schedule is created
- **WHEN** 用户创建一个定时采集或自动推进 schedule
- **THEN** 系统 MUST 持久化一个通过 schema 校验的 `LocalSchedule` JSON 对象
- **AND** schedule status MUST 为 `enabled`
- **AND** schedule MUST 包含可计算下一次运行时间的 rule

#### Scenario: Schedule payload contains unsafe data
- **WHEN** schedule 配置包含 API key、cookie、原始资料正文或其他凭证内容
- **THEN** 系统 MUST reject 该 schedule
- **AND** 不写入 schedule 文件

### Requirement: Schedule storage uses helpers
系统 SHALL 通过 storage path helpers 解析 schedule 落盘路径。Schedule 文件 MUST 存储在 `knowledge/schedules/` 下，并在读写时通过 Zod 校验。

#### Scenario: Schedule is saved
- **WHEN** workflow 保存 schedule
- **THEN** 文件路径 MUST 由 storage helper 生成
- **AND** CLI 和 workflow MUST NOT 手写 `knowledge/` 路径字符串

#### Scenario: Existing workspace has no schedules directory
- **WHEN** 用户在旧工作区首次创建 schedule
- **THEN** storage helper MUST 创建 `knowledge/schedules/`
- **AND** 不修改已有 Candidate、Source、Note、Index 或 LocalTask 文件

### Requirement: Scheduler tick runs due enabled schedules
系统 SHALL 提供 scheduler tick workflow，扫描 enabled schedules，并只运行 `next_run_at` 已到期的 schedule。每次 tick MUST 更新 schedule 最近运行摘要，并基于 rule 计算新的 `next_run_at`。

#### Scenario: Enabled schedule is due
- **WHEN** scheduler tick 发现 enabled schedule 的 `next_run_at` 小于或等于当前时间
- **THEN** scheduler MUST 执行该 schedule 对应动作
- **AND** scheduler MUST 更新 `last_run_at`、`next_run_at` 和最近运行摘要

#### Scenario: Enabled schedule is not due
- **WHEN** scheduler tick 发现 enabled schedule 的 `next_run_at` 晚于当前时间
- **THEN** scheduler MUST skip 该 schedule
- **AND** 不执行该 schedule 对应动作

#### Scenario: Schedule is disabled
- **WHEN** scheduler tick 扫描到 status 为 `disabled` 的 schedule
- **THEN** scheduler MUST NOT 执行该 schedule
- **AND** MUST NOT 更新 `last_run_at`

### Requirement: Scheduled collection creates Candidates only
系统 SHALL 支持定时触发已有 Candidate collectors。Scheduled collection MUST 调用现有 candidate collection workflow，并保持 collection 只创建 Candidate 的边界。

#### Scenario: GitHub Trending schedule runs
- **WHEN** due schedule type 为 `candidate.collect` 且 provider 为 `github-trending`
- **THEN** scheduler MUST 调用 GitHub Trending collection workflow
- **AND** workflow MUST 只创建或跳过 Candidate
- **AND** 不创建 Source、Note 或 Index Entry

#### Scenario: Hacker News schedule runs
- **WHEN** due schedule type 为 `candidate.collect` 且 provider 为 `hacker-news`
- **THEN** scheduler MUST 调用 Hacker News collection workflow
- **AND** workflow MUST 只创建或跳过 Candidate
- **AND** 不调用 understand、discussion、note compose 或 answer agent

### Requirement: Auto advancement only schedules safe workflow steps
系统 SHALL 支持自动推进已满足前置条件的非人工确认步骤。Auto advancement MUST 使用 allowlist 限制可自动入队或执行的步骤，并 MUST 保留所有现有 workflow gates。

#### Scenario: Ingested Source can be processed automatically
- **WHEN** auto advancement 扫描到 `Source.status = ingested`
- **THEN** scheduler MAY enqueue or run `source.process`
- **AND** 实际状态变化 MUST 由 source processing workflow 完成

#### Scenario: Processed Source can be understood automatically
- **WHEN** auto advancement 扫描到 `Source.status = processed` 且 processing artifacts 存在
- **THEN** scheduler MAY enqueue or run `source.understand`
- **AND** LLM output MUST 通过 schema validation 后 workflow 才能继续

#### Scenario: Draft Note can be linted automatically
- **WHEN** auto advancement 扫描到 `Note.status = draft`
- **THEN** scheduler MAY enqueue or run `note.lint`
- **AND** lint result MUST 写入 Note quality checks through existing workflow

#### Scenario: Approved Note can be indexed automatically
- **WHEN** auto advancement 扫描到 `Note.status = approved` 且缺少主 index entry
- **THEN** scheduler MAY enqueue or run `note.index`
- **AND** index workflow MUST enforce approved-only indexing

### Requirement: Auto advancement stops at human confirmation gates
系统 SHALL 禁止自动推进越过需要用户明确判断的边界。Scheduler MUST NOT 自动选择 Candidate、approve Source、compose formal Note、approve Note，或把未 approved Note 写入主检索。

#### Scenario: Recommended Candidate is available
- **WHEN** auto advancement 扫描到 `Candidate.status = recommended`
- **THEN** scheduler MUST NOT run `candidate.select`
- **AND** Candidate MUST 等待用户显式选择

#### Scenario: Discussion is ready for approval
- **WHEN** auto advancement 扫描到 Source discussion summary `ready_for_approval = true`
- **THEN** scheduler MUST NOT run `source.approve`
- **AND** Source MUST 等待用户显式确认

#### Scenario: Source is approved for note
- **WHEN** auto advancement 扫描到 `Source.status = approved_for_note`
- **THEN** scheduler MUST NOT run `note.compose`
- **AND** 正式 Note 草稿生成 MUST 保持为显式用户动作

#### Scenario: Draft Note passed lint
- **WHEN** auto advancement 扫描到 `Note.status = draft` 且 `quality_checks.status = passed`
- **THEN** scheduler MUST NOT run `note.approve`
- **AND** Note MUST 等待用户显式 approve

### Requirement: Scheduler deduplicates generated tasks
系统 SHALL 在 scheduler 为自动推进创建 LocalTask 前执行去重。若存在相同 task type、target id 和关键 options 的 pending、running 或 retryable_failed task，scheduler MUST skip 创建重复任务并记录原因。

#### Scenario: Equivalent task already pending
- **WHEN** scheduler 准备 enqueue `source.process` for a Source
- **AND** 已存在等价的 pending task
- **THEN** scheduler MUST NOT 创建第二个 task
- **AND** tick summary MUST 记录 skipped duplicate

#### Scenario: Equivalent task already succeeded
- **WHEN** scheduler 准备 enqueue 某步骤
- **AND** 仅存在历史 succeeded task 但目标对象当前状态仍满足前置条件
- **THEN** scheduler MAY 创建新的 task
- **AND** workflow gates MUST 决定该 task 是否仍可执行

### Requirement: Schedule CLI exposes local automation operations
系统 SHALL 通过 CLI 暴露本地 schedule 操作。CLI MUST 支持创建、启用、禁用、列表、查看、tick 和机器可读 JSON 输出。

#### Scenario: User creates collection schedule
- **WHEN** 用户运行 schedule create command 创建 provider 为 `github-trending` 或 `hacker-news` 的 collection schedule
- **THEN** CLI MUST 调用 schedule create workflow
- **AND** 输出 schedule id、status 和 next run time

#### Scenario: User disables schedule
- **WHEN** 用户运行 schedule disable command
- **THEN** 系统 MUST 将 schedule status 更新为 `disabled`
- **AND** 后续 scheduler tick MUST 不执行该 schedule

#### Scenario: User runs one scheduler tick
- **WHEN** 用户运行 `ai-knowledge schedule tick`
- **THEN** CLI MUST 调用 scheduler tick workflow
- **AND** 输出本次 tick 执行、跳过和失败的 schedule 摘要

#### Scenario: User requests JSON output
- **WHEN** 用户运行 schedule command with `--json`
- **THEN** CLI MUST 输出 machine-readable workflow result JSON
