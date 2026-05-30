# Candidate Storage Specification

## Purpose

This capability defines local filesystem storage, read-only workflows, and CLI viewing for Candidate objects while keeping Candidates outside the main approved knowledge and answer retrieval layer.

## Requirements

### Requirement: Candidate JSON is stored under candidates root
系统 SHALL 将 Candidate JSON 持久化到本地 knowledge storage 的 candidates root 下。Candidate file path MUST 为 `knowledge/candidates/YYYY/MM/<candidate_id>.json`，其中 YYYY/MM MUST 从 Candidate id 的日期部分解析得到。Storage path MUST 由 storage path helper 生成，不得由 CLI 或 workflow 手写。

#### Scenario: Candidate is saved
- **WHEN** storage 层保存 id 为 `cand_20260506_github_trending_openmanus` 的 Candidate
- **THEN** Candidate JSON 写入 `knowledge/candidates/2026/05/cand_20260506_github_trending_openmanus.json`
- **AND** 写入前 MUST 通过 `parse_candidate` 校验

#### Scenario: Candidate id has invalid path shape
- **WHEN** storage 层尝试为无法解析日期的 Candidate id 生成路径
- **THEN** storage MUST reject该路径请求
- **AND** 不得写入 candidates root 之外的位置

### Requirement: Candidate repository reads and lists Candidates
系统 SHALL 提供 Candidate repository，用于创建、读取和列出 Candidate。Repository MUST 在读写 JSON 时通过 `CandidateSchema` / `parse_candidate` 校验对象，并 MUST 支持按 status 过滤列表。Collector workflow MAY use repository create behavior to persist newly collected Candidates, but repository MUST still reject invalid Candidate JSON and MUST NOT write to Source、Note 或 Index storage.

#### Scenario: Read Candidate by id
- **WHEN** 调用 repository 读取已存在的 Candidate id
- **THEN** 系统返回通过 domain parse 的 Candidate 对象

#### Scenario: Candidate does not exist
- **WHEN** 调用 repository 读取不存在的 Candidate id
- **THEN** 系统返回 storage not found error

#### Scenario: List Candidates sorted by collected_at
- **WHEN** candidates root 下存在多个 Candidate JSON
- **THEN** list 默认按 `collected_at` 降序返回 Candidates

#### Scenario: List Candidates by status
- **WHEN** 调用 list 并指定 `status = recommended`
- **THEN** 只返回 status 为 `recommended` 的 Candidates

#### Scenario: Collector saves Candidate through repository
- **WHEN** collector workflow 通过 repository 保存新 Candidate
- **THEN** repository MUST validate the Candidate with `parse_candidate`
- **AND** Candidate JSON MUST be written only under candidates storage
- **AND** no Source、Note 或 Index file is created by the repository

### Requirement: Candidate repository updates Candidate JSON
系统 SHALL 支持更新已存在的 Candidate JSON。Update MUST 通过 `parse_candidate` 校验更新后的 Candidate，并 MUST 只写回原 Candidate storage path，不得创建 Source、Note 或 Index Entry。Candidate select workflow MAY use repository update behavior to persist `selected` and `converted` status changes.

#### Scenario: Candidate is updated
- **WHEN** workflow 更新 Candidate score、status、scored_at 或 converted_source_id
- **THEN** repository MUST validate the updated Candidate
- **AND** repository MUST write it to the existing Candidate JSON path

#### Scenario: Candidate update target is missing
- **WHEN** workflow 尝试更新不存在的 Candidate
- **THEN** repository MUST return not found error

#### Scenario: Candidate update does not affect main knowledge
- **WHEN** Candidate repository updates Candidate JSON
- **THEN** no Source、Note 或 Index file is created

#### Scenario: Candidate select updates conversion fields
- **WHEN** Candidate select workflow completes Source creation
- **THEN** repository MAY persist `status = converted`
- **AND** repository MAY persist `converted_source_id = <source_id>`

### Requirement: Candidate read-only workflows are exposed
系统 SHALL 提供只读 Candidate workflow，用于 list 与 show。Workflow MUST 调用 Candidate repository，返回适合 CLI 展示的 Candidate summary，且 MUST NOT 修改 Candidate、Source、Note 或 Index Entry。

#### Scenario: List Candidate workflow succeeds
- **WHEN** 用户请求 Candidate list workflow
- **THEN** workflow 返回 Candidate summaries
- **AND** summaries 按 `collected_at desc` 排序

#### Scenario: Show Candidate workflow succeeds
- **WHEN** 用户请求已存在 Candidate 的 show workflow
- **THEN** workflow 返回该 Candidate 的 summary 或详情

#### Scenario: Candidate workflow is read-only
- **WHEN** list 或 show workflow 执行
- **THEN** workflow 不改变 Candidate status
- **AND** 不创建 Source
- **AND** 不创建 Note 或 Index Entry

### Requirement: Candidate CLI supports list and show
系统 SHALL 暴露 `ai-knowledge candidate list` 与 `ai-knowledge candidate show <candidate_id>` 只读 CLI。`candidate list` MUST 支持 `--status <status>` 过滤；list 与 show MUST 支持 `--json` 输出。

#### Scenario: User lists Candidates
- **WHEN** 用户运行 `ai-knowledge candidate list`
- **THEN** CLI 打印 Candidate id、status、source_type、title、score、collected_at 等摘要信息

#### Scenario: User filters Candidate list by status
- **WHEN** 用户运行 `ai-knowledge candidate list --status recommended`
- **THEN** CLI 只展示 recommended Candidates

#### Scenario: User shows Candidate
- **WHEN** 用户运行 `ai-knowledge candidate show <candidate_id>`
- **THEN** CLI 打印该 Candidate 的只读详情

#### Scenario: User requests Candidate JSON output
- **WHEN** 用户运行 `candidate list --json` 或 `candidate show <candidate_id> --json`
- **THEN** CLI 输出 workflow result JSON

### Requirement: Candidate remains outside main knowledge retrieval
系统 SHALL 保持 Candidate 在主知识层之外。Candidate storage、list、show MUST NOT 写入 `knowledge/index/`，answer workflow MUST NOT 直接检索 Candidate。

#### Scenario: Candidate is saved and listed
- **WHEN** 系统保存并列出 Candidate
- **THEN** 不创建任何 `knowledge/index/` entry

#### Scenario: User asks answer question matching Candidate text
- **WHEN** 只有 Candidate 匹配问题且没有 approved Note 匹配
- **THEN** answer workflow 仍报告没有相关已确认知识
- **AND** 不直接使用 Candidate 作为 answer evidence
