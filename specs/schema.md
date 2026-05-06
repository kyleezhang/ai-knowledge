# AI 学习助手 Schema Spec

## 1. 文档目标

本文档定义 AI 学习助手 MVP 阶段的核心对象 schema、目录落盘约定、字段含义与最小约束。

本文件是对 `specs/prd.md` 与 `specs/workflow.md` 的对象层补充，重点回答：

- 每个核心对象的最小字段是什么
- 哪些字段是主真相字段，哪些字段仅服务导出或检索
- 各对象如何落盘到本地文件系统
- 各对象之间如何建立引用与追溯关系

## 2. 目录约定

MVP 阶段的知识目录固定为：

```text
knowledge/
  candidates/
  sources/
  notes/
  index/
```

### 2.1 Candidate

每个 `Candidate` 一个 JSON 文件，例如：

```text
knowledge/candidates/2026/05/cand_20260506_github_trending_openmanus.json
```

### 2.2 Source

每个 `Source` 一个目录，例如：

```text
knowledge/sources/2026/05/src_20260506_pdf_context-engineering/
  source.json
  discussion.jsonl
  raw/
  processed/
```

### 2.3 Note

每个 `Note` 一个目录，例如：

```text
knowledge/notes/2026/05/note_20260506_ai-coding-agent/
  note.json
  note.md
```

### 2.4 Index Entry

每个 `Note` 一个索引文件，例如：

```text
knowledge/index/2026/05/note_20260506_ai-coding-agent.index.json
```

## 3. 通用规则

### 3.1 时间字段

所有时间字段统一使用 ISO 8601 UTC 时间字符串，例如：

```json
"2026-05-06T10:00:00Z"
```

### 3.2 ID 规则

- `Candidate`：`cand_{date}_{source_type}_{slug}`
- `Source`：`src_{date}_{ingest_type}_{slug}`
- `Note`：`note_{date}_{slug}`，版本时在目录或 id 末尾追加版本后缀

当 slug 可能冲突时，可追加短 hash 保证唯一性。

### 3.3 状态字段

所有状态字段必须使用枚举值，不允许自由文本。

### 3.4 主真相边界

- `note.json` 是正式知识的主真相
- `note.md` 是导出视图，不可反向成为主编辑面
- `Source` 是处理、理解、讨论阶段的主工作对象
- `Candidate` 不进入主知识层
- `Index Entry` 是检索入口，不是知识主真相

## 4. Candidate Schema

### 4.1 角色定位

`Candidate` 是自动采集链路中的轻量候选对象，用于：

- 候选池管理
- 去重与过滤
- 规则评分
- 推荐列表展示
- 转换为 `Source`

### 4.2 最小字段

```json
{
  "id": "cand_20260506_github_trending_openmanus",
  "source_type": "github_trending",
  "title": "OpenManus",
  "summary": "A brief preview for recommendation list.",
  "url": "https://example.com",
  "author": "owner_or_submitter",
  "published_at": "2026-05-06T00:00:00Z",
  "collected_at": "2026-05-06T08:30:00Z",
  "scored_at": "2026-05-06T08:31:00Z",
  "tags": ["agent", "coding-agent"],
  "status": "recommended",
  "score": {
    "total": 10,
    "breakdown": {
      "relevance": 3,
      "learning_value": 3,
      "novelty": 2,
      "discussability": 2
    },
    "reason": "High relevance to AI agent engineering and strong discussion value."
  },
  "external_ref": {
    "platform": "github",
    "id": "owner/repo",
    "url": "https://github.com/owner/repo",
    "extra": {
      "rank": 1
    }
  },
  "converted_source_id": "src_20260506_github_trending_openmanus"
}
```

### 4.3 字段说明

- `id`：Candidate 唯一标识
- `source_type`：采集来源类型，MVP 包括 `github_trending`、`hacker_news`
- `title`：候选项标题
- `summary`：推荐列表预览摘要
- `url`：候选项主链接
- `author`：作者、提交者或 repo owner 等可识别来源主体
- `published_at`：原始内容发布时间；缺失时可为 `null`
- `collected_at`：被采集进入候选池的时间
- `scored_at`：完成评分的时间
- `tags`：轻量主题标签
- `status`：候选状态
- `score`：规则评分结构
- `external_ref`：外部平台原始标识
- `converted_source_id`：转换后的 `Source` 引用；未转换时为 `null`

### 4.4 状态枚举

- `new`
- `recommended`
- `dismissed`
- `selected`
- `converted`

### 4.5 评分字段约定

`score.breakdown` 固定包含：

- `relevance`
- `learning_value`
- `novelty`
- `discussability`

每项推荐范围为 0-3 分；`total` 为汇总分。

## 5. Source Schema

### 5.1 角色定位

`Source` 是进入学习流程的正式资料对象，承载：

- 原始资料快照
- 处理中间产物
- 初步理解
- 讨论摘要
- 与 `Note` 的映射关系

### 5.2 目录结构

```text
<source-dir>/
  source.json
  discussion.jsonl
  raw/
  processed/
```

- `raw/`：原始导入文件、副本或抓取快照
- `processed/`：清洗文本、分段、元数据等处理中间产物
- `discussion.jsonl`：原始讨论消息流
- `source.json`：Source 主控制面

### 5.3 最小字段

```json
{
  "id": "src_20260506_pdf_context-engineering",
  "title": "Context Engineering",
  "status": "understanding_ready",
  "ingest_type": "upload_pdf",
  "content_type": "document",
  "origin": {
    "type": "user_import",
    "candidate_id": null,
    "user_input_type": "pdf"
  },
  "origin_candidate_id": null,
  "url": null,
  "author": "Some Author",
  "published_at": "2026-05-01T00:00:00Z",
  "ingested_at": "2026-05-06T09:00:00Z",
  "updated_at": "2026-05-06T09:10:00Z",
  "processing_artifacts": {
    "clean_text": "processed/clean_text.md",
    "segments": "processed/segments.json",
    "metadata": "processed/metadata.json"
  },
  "draft_understanding": {
    "summary": "...",
    "key_points": ["..."],
    "uncertainties": ["..."],
    "discussion_starters": ["..."],
    "generated_at": "2026-05-06T09:12:00Z"
  },
  "discussion_summary": {
    "discussion_status": "open",
    "summary_version": 1,
    "confirmed_points": [],
    "open_questions": [],
    "unresolved_issues": [],
    "next_prompts": [],
    "ready_for_approval": false,
    "last_updated_at": "2026-05-06T09:20:00Z"
  },
  "note_ids": []
}
```

### 5.4 字段说明

- `id`：Source 唯一标识
- `title`：资料标题
- `status`：Source 当前工作流状态
- `ingest_type`：接入方式，例如 `upload_pdf`、`upload_markdown`、`lark_doc`、`candidate_selected`
- `content_type`：内容模态，例如 `document`、`link`
- `origin`：来源结构，标识该 Source 来自候选池还是用户主动导入
- `origin_candidate_id`：若由 Candidate 转换而来，则记录原 Candidate id
- `url`：原始链接；本地文件导入可为 `null`
- `author`：资料作者或来源主体
- `published_at`：原始发布时间；缺失时可为 `null`
- `ingested_at`：Source 创建时间
- `updated_at`：最近更新时间
- `processing_artifacts`：处理中间产物索引
- `draft_understanding`：初步理解草稿
- `discussion_summary`：结构化讨论摘要
- `note_ids`：与该 Source 关联的 Note 列表

### 5.5 状态枚举

- `ingested`
- `processing`
- `processed`
- `understanding_ready`
- `discussing`
- `approved_for_note`
- `noted`
- `archived`
- `failed`

### 5.6 origin 结构

```json
{
  "type": "user_import",
  "candidate_id": null,
  "user_input_type": "pdf"
}
```

其中：

- `type`：`candidate` | `user_import`
- `candidate_id`：来源 Candidate；若非 Candidate 转换则为 `null`
- `user_input_type`：用户导入类型，例如 `pdf`、`markdown`、`lark_doc`

### 5.7 processing_artifacts 约定

`processing_artifacts` 是 `source.json` 对 `processed/` 目录中产物的显式索引。键名可按职责命名，常见包括：

- `clean_text`
- `segments`
- `metadata`

值统一为相对 `source` 目录的相对路径。

## 6. Draft Understanding Schema

### 6.1 角色定位

`draft_understanding` 是 `Source` 的内嵌结构，不作为独立主对象。

### 6.2 最小字段

```json
{
  "summary": "...",
  "key_points": ["..."],
  "uncertainties": ["..."],
  "discussion_starters": ["..."],
  "generated_at": "2026-05-06T09:12:00Z"
}
```

### 6.3 字段要求

- `summary`：简短概述当前理解
- `key_points`：当前识别到的主要观点
- `uncertainties`：显式不确定点
- `discussion_starters`：建议进入讨论的切口
- `generated_at`：生成时间

## 7. Discussion Summary Schema

### 7.1 角色定位

`discussion_summary` 是 `Source` 的内嵌结构，用于承载讨论阶段的结构化收敛结果；原始消息单独保存在 `discussion.jsonl` 中。

### 7.2 最小字段

```json
{
  "discussion_status": "open",
  "summary_version": 3,
  "confirmed_points": ["..."],
  "open_questions": ["..."],
  "unresolved_issues": ["..."],
  "next_prompts": ["..."],
  "ready_for_approval": false,
  "last_updated_at": "2026-05-06T10:20:00Z"
}
```

### 7.3 字段说明

- `discussion_status`：讨论状态
- `summary_version`：讨论摘要版本号
- `confirmed_points`：已形成共识的点
- `open_questions`：仍需用户补充判断的问题
- `unresolved_issues`：信息缺口、冲突点或未解决问题
- `next_prompts`：建议进入下一轮讨论的切口
- `ready_for_approval`：是否已达到可请求确认的门槛
- `last_updated_at`：最近更新时间

### 7.4 状态枚举

- `open`
- `waiting_user`
- `ready_for_approval`
- `closed`

### 7.5 discussion.jsonl 约定

`discussion.jsonl` 中每一行是一条原始消息记录，至少应包含：

- `role`
- `content`
- `created_at`

如后续需要，可扩展消息级 metadata，但不影响 `discussion_summary` 作为主收敛结构。

## 8. Note Schema

### 8.1 角色定位

`Note` 是正式知识对象。`note.json` 是主真相；`note.md` 是面向阅读的高质量导出视图。

### 8.2 目录结构

```text
<note-dir>/
  note.json
  note.md
```

### 8.3 最小字段

```json
{
  "id": "note_20260506_ai-coding-agent",
  "title": "AI Coding Agent",
  "slug": "ai-coding-agent",
  "status": "approved",
  "version": 1,
  "root_note_id": "note_20260506_ai-coding-agent",
  "supersedes_note_id": null,
  "superseded_by_note_id": null,
  "created_at": "2026-05-06T10:00:00Z",
  "updated_at": "2026-05-06T10:10:00Z",
  "approved_at": "2026-05-06T10:08:00Z",
  "conclusions": ["..."],
  "why_it_matters": ["..."],
  "current_understanding": "...",
  "open_questions": ["..."],
  "related_note_ids": ["note_20260501_long-term-memory-systems"],
  "source_refs": [
    {
      "source_id": "src_20260506_github_trending_openmanus",
      "source_title": "OpenManus",
      "source_url": "https://github.com/...",
      "evidence_refs": ["processed/segments.json#12"]
    }
  ],
  "approval_context": {
    "source_id": "src_20260506_github_trending_openmanus",
    "discussion_ref": "discussion.jsonl",
    "approved_from_summary_version": 3
  },
  "render_metadata": {
    "markdown_template_version": "v1"
  },
  "quality_checks": {
    "status": "passed",
    "template_complete": true,
    "source_links_present": true,
    "empty_sections": [],
    "last_checked_at": "2026-05-06T10:09:00Z"
  }
}
```

### 8.4 字段分层

#### A. 主真相字段

- `conclusions`
- `why_it_matters`
- `current_understanding`
- `open_questions`
- `related_note_ids`
- `source_refs`

#### B. 展示与导出支持字段

- `title`
- `slug`
- `render_metadata`

#### C. 版本与治理字段

- `status`
- `version`
- `root_note_id`
- `supersedes_note_id`
- `superseded_by_note_id`
- `approval_context`
- `quality_checks`

### 8.5 状态枚举

- `draft`
- `approved`
- `archived`
- `superseded`

### 8.6 字段说明

- `id`：Note 唯一标识
- `title`：展示标题
- `slug`：用于目录与文件命名的主题标识
- `status`：Note 状态
- `version`：版本号，从 1 开始递增
- `root_note_id`：版本链根节点 id
- `supersedes_note_id`：当前 Note 替代的旧版 Note id
- `superseded_by_note_id`：当前 Note 被哪个新版替代
- `created_at` / `updated_at` / `approved_at`：时间字段
- `conclusions`：最终结论列表
- `why_it_matters`：价值判断列表
- `current_understanding`：当前整体理解
- `open_questions`：未解决问题
- `related_note_ids`：相关笔记引用
- `source_refs`：结构化来源引用
- `approval_context`：确认上下文
- `render_metadata`：导出模板相关元信息
- `quality_checks`：QA 结果

### 8.7 source_refs 结构

```json
{
  "source_id": "src_20260506_github_trending_openmanus",
  "source_title": "OpenManus",
  "source_url": "https://github.com/...",
  "evidence_refs": ["processed/segments.json#12"]
}
```

### 8.8 approval_context 结构

```json
{
  "source_id": "src_20260506_github_trending_openmanus",
  "discussion_ref": "discussion.jsonl",
  "approved_from_summary_version": 3
}
```

### 8.9 quality_checks 结构

```json
{
  "status": "passed",
  "template_complete": true,
  "source_links_present": true,
  "empty_sections": [],
  "last_checked_at": "2026-05-06T10:09:00Z"
}
```

其中：

- `status`：`passed` | `failed`
- `template_complete`：模板完整性检查结果
- `source_links_present`：来源链接完整性检查结果
- `empty_sections`：空章节列表
- `last_checked_at`：最近检查时间

## 9. Index Entry Schema

### 9.1 角色定位

`Index Entry` 是面向问答的检索入口。MVP 中仅主索引 `approved` 状态的 `Note`。

### 9.2 最小字段

```json
{
  "note_id": "note_20260506_ai-coding-agent",
  "title": "AI Coding Agent",
  "summary": "Condensed retrieval summary.",
  "keywords": ["ai coding agent", "agent engineering"],
  "tags": ["agent", "coding"],
  "status": "approved",
  "approved_at": "2026-05-06T10:08:00Z",
  "related_note_ids": ["note_20260501_long-term-memory-systems"],
  "vector_ref": "vectors/note_20260506_ai-coding-agent.vec"
}
```

### 9.3 字段说明

- `note_id`：索引项对应的 Note id
- `title`：Note 标题
- `summary`：检索摘要
- `keywords`：关键词列表
- `tags`：主题标签
- `status`：仅允许 `approved`
- `approved_at`：进入主知识层时间
- `related_note_ids`：相关笔记关系
- `vector_ref`：向量索引引用或定位标识

## 10. 跨对象引用规则

### 10.1 Candidate 与 Source

- `Candidate.converted_source_id` 指向转换后的 `Source`
- `Source.origin_candidate_id` 指回原 `Candidate`

### 10.2 Source 与 Note

- `Source.note_ids` 记录关联 `Note`
- `Note.source_refs[].source_id` 指向来源 `Source`
- `Note.approval_context.source_id` 指向用于确认的主 `Source`

### 10.3 Note 版本链

- `root_note_id` 标识版本链根节点
- `supersedes_note_id` 指向旧版本
- `superseded_by_note_id` 指向新版本

## 11. MVP 校验建议

在实现层，建议至少校验以下规则：

- 所有对象必须有稳定 id
- 状态字段必须属于枚举值
- `approved` Note 必须存在 `approved_at`
- `approved` Note 必须存在 `quality_checks.status = passed`
- `Candidate.status = converted` 时必须存在 `converted_source_id`
- `Source.origin.type = candidate` 时必须存在 `origin_candidate_id`
- `discussion_summary.ready_for_approval = true` 时必须存在至少一个 `confirmed_points`
- `Index Entry.status` 只能为 `approved`

## 12. 非目标

本文档仅定义 MVP 阶段的对象契约，不覆盖：

- Notion / Obsidian 双向同步 schema
- 多用户协作对象模型
- 视频 / 图片等暂未纳入 MVP 的模态 schema
- 向量索引底层实现细节
