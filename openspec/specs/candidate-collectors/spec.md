# Candidate Collectors Specification

## Purpose

This capability defines GitHub Trending and Hacker News collectors that create Candidate objects while preserving the boundary that collected content must not directly become Source, Note, Index Entry, or answer evidence.

## Requirements

### Requirement: Collectors normalize external entries into Candidate inputs
系统 SHALL 提供 GitHub Trending 与 Hacker News collector，并将外部条目规范化为统一的 Candidate 创建输入。Collector 输出 MUST 包含 title、summary、url、author、published_at、tags、external_ref，并 MUST 标明对应 Candidate `source_type`。

#### Scenario: GitHub Trending entry is normalized
- **WHEN** GitHub Trending collector 解析到一个仓库条目
- **THEN** 输出的 Candidate input 使用 `source_type = github_trending`
- **AND** 包含 title、summary、url、author、published_at、tags、external_ref

#### Scenario: Hacker News entry is normalized
- **WHEN** Hacker News collector 解析到一个 story 条目
- **THEN** 输出的 Candidate input 使用 `source_type = hacker_news`
- **AND** 包含 title、summary、url、author、published_at、tags、external_ref

### Requirement: Collector requests are mockable
系统 SHALL 允许 collector 的外部请求被注入或 mock。默认测试 MUST NOT 依赖真实 GitHub、Hacker News 或公网网络。

#### Scenario: Collector test uses mocked response
- **WHEN** collector 测试运行
- **THEN** 测试通过注入 response fixture 或 fake fetcher 提供外部数据
- **AND** 不访问真实网络

#### Scenario: External request fails
- **WHEN** GitHub 或 Hacker News 请求失败、返回不可解析内容或缺少必要字段
- **THEN** collector 或 workflow MUST 返回结构化错误
- **AND** 不产生半成品 Candidate

### Requirement: Collected items are saved as new Candidates
系统 SHALL 提供 collect workflow，将 collector 输出转换为 Candidate 并保存到 Candidate repository。Workflow MUST 设置系统控制字段，包括 Candidate id、`collected_at`、初始 `status = new`、零值 score、`converted_source_id = null`。

#### Scenario: GitHub Trending collection succeeds
- **WHEN** 用户触发 GitHub Trending collection 且 collector 返回有效条目
- **THEN** workflow 保存 Candidate JSON 到 candidates storage
- **AND** Candidate `status = new`
- **AND** Candidate `score.total = 0`

#### Scenario: Hacker News collection succeeds
- **WHEN** 用户触发 Hacker News collection 且 collector 返回有效条目
- **THEN** workflow 保存 Candidate JSON 到 candidates storage
- **AND** Candidate `status = new`
- **AND** Candidate `score.total = 0`

### Requirement: Candidate collection is Candidate-only
系统 SHALL 保证 collector 只创建 Candidate。Collector workflow MUST NOT 创建 Source、Note、Index Entry，MUST NOT 调用 LLM Agent，MUST NOT 把采集结果直接加入 answer retrieval。

#### Scenario: Collection completes
- **WHEN** collect workflow 成功保存 Candidate
- **THEN** 不创建任何 Source
- **AND** 不创建任何 Note
- **AND** 不写入 main index
- **AND** 不调用 understand、discussion、note compose 或 answer agent

### Requirement: Candidate collection CLI is explicit
系统 SHALL 提供显式 CLI 入口用于手动触发一次 GitHub Trending 或 Hacker News collection。CLI MUST 支持 JSON 输出，并 MUST 明确输出创建的 Candidate ids 或错误。

#### Scenario: User collects GitHub Trending Candidates
- **WHEN** 用户运行 `ai-knowledge candidate collect github-trending`
- **THEN** CLI 触发 GitHub Trending collector workflow
- **AND** 输出创建的 Candidate summaries 或 ids

#### Scenario: User collects Hacker News Candidates
- **WHEN** 用户运行 `ai-knowledge candidate collect hacker-news`
- **THEN** CLI 触发 Hacker News collector workflow
- **AND** 输出创建的 Candidate summaries 或 ids

#### Scenario: User requests JSON collection output
- **WHEN** 用户运行 `candidate collect github-trending --json` 或 `candidate collect hacker-news --json`
- **THEN** CLI 输出 workflow result JSON
