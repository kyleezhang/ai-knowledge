# AI 学习助手 Implementation Spec

## 1. 文档目标

本文档基于 `specs/prd.md`、`specs/workflow.md` 与 `specs/schema.md`，描述 AI 学习助手 MVP 阶段的整体实现规范、技术栈选择、模块边界与阶段计划。

本文档是后续逐项讨论功能点的实现基线。若实现过程中发现本文档与 PRD、Workflow 或 Schema 冲突，应先回到 spec 层讨论并更新文档，再进入代码实现。

## 2. 已确认的整体技术决策

以下决策作为当前实现基线：

1. 主语言使用 **TypeScript + Node.js LTS**。
2. MVP 采用 **CLI first**，暂不建设 Web UI。
3. TypeScript 对象字段与 JSON schema 保持一致，统一使用 `snake_case`。
4. P0 只支持 **Markdown 主动导入**，PDF 放到 P1。
5. `Source` 允许扩展 `last_error` 字段，用于记录最近一次流程失败。
6. P0 检索先使用 **关键词 / metadata 检索**，暂不引入向量检索。

## 3. 总体实现原则

### 3.1 先跑通知识闭环

MVP 的核心目标是验证以下链路：

```text
Candidate -> Source -> Processed Artifacts -> Draft Understanding
-> Discussion Summary -> Approved Note -> Index Entry -> QA Answer
```

第一阶段不优先建设复杂 Web UI、多人协作、外部平台同步、高级推荐系统或向量检索，而是优先保证对象边界、状态流转、讨论闭环和 Note 主真相稳定运行。

### 3.2 本地文件系统作为 MVP 主存储

MVP 阶段采用本地文件系统作为主存储，严格遵守 `specs/schema.md` 的目录约定：

```text
knowledge/
  candidates/
  sources/
  notes/
  index/
```

约定：

- `Candidate` 使用单个 JSON 文件落盘。
- `Source` 使用独立目录落盘，包含 `source.json`、`discussion.jsonl`、`raw/`、`processed/`。
- `Note` 使用独立目录落盘，包含 `note.json` 与 `note.md`。
- `Index Entry` 使用单个 JSON 文件落盘。

### 3.3 JSON 是主真相，Markdown 是导出视图

实现层必须强制以下边界：

- `source.json` 是处理、理解、讨论阶段的主工作对象。
- `note.json` 是正式知识对象的主真相。
- `note.md` 只是由 `note.json` 渲染出的阅读视图。
- `Candidate` 不进入主知识层。
- `Index Entry` 是检索入口，不是知识主真相。

任何对正式知识结论的修改，都应先修改 `note.json`，再重新渲染 `note.md`。

### 3.4 显式状态机优先于隐式流程

业务代码不得随意直接修改对象状态。所有状态流转都应通过统一状态机函数完成，并校验是否符合 `specs/workflow.md` 的阶段边界。

示例：

```ts
transition_source(source, 'processing')
transition_source(source, 'processed')
transition_source(source, 'understanding_ready')
```

不允许：

```ts
source.status = 'approved_for_note'
```

### 3.5 讨论是正式笔记生成的必要门槛

MVP 不允许从原始资料或初步理解草稿直接生成正式 Note。正式 Note 必须满足：

- 已存在 `draft_understanding`。
- 已存在讨论记录与结构化 `discussion_summary`。
- `discussion_summary` 达到可确认状态。
- 用户明确确认当前结构化结论可落笔。
- `Source.status = approved_for_note`。

## 4. 技术栈规范

### 4.1 语言、运行时与包管理

```text
语言：TypeScript
运行时：Node.js LTS
包管理：pnpm
模块格式：ESM
```

选择 TypeScript 的原因：

- 适合 CLI、本地文件系统、JSON schema 校验和 Markdown 处理。
- LLM SDK / API 生态适配较好。
- 类型系统足以承载 `Candidate / Source / Note / IndexEntry` 等对象契约。
- 后续如果增加 Web UI，可以复用 domain、storage、workflow、agent 层。

### 4.2 推荐依赖

P0 建议依赖：

```text
commander 或 cac：CLI
@anthropic-ai/sdk：Anthropic-compatible LLM 调用
zod：运行时 schema 校验
unified / remark：Markdown 解析与处理
vitest：测试
eslint：Lint
prettier：格式化
```

P1 再引入 PDF 相关依赖，例如 `pdf-parse`。

P3 再讨论向量存储或 embedding 方案。

### 4.3 配置规范

建议使用项目级配置文件：

```text
ai-knowledge.config.json
```

示例：

```json
{
  "knowledge_dir": "./knowledge",
  "timezone": "Asia/Shanghai",
  "model": {
    "provider": "anthropic_compatible",
    "base_url": "https://api.deepseek.com/anthropic",
    "api_key_env": "GATEWAY_API_KEY",
    "default_model": "deepseek-v4-pro"
  },
  "embedding": {
    "provider": "voyage",
    "base_url": "https://api.voyageai.com/v1",
    "api_key_env": "VOYAGE_API_KEY",
    "default_model": "voyage-4",
    "embedding_dimensions": 1024
  }
}
```

配置文件只存放非敏感配置。API key 等敏感信息必须走环境变量，不得写入仓库。Anthropic 当前不提供自有 embedding 模型；P3 embedding provider 默认使用 Voyage HTTP API，显式向量索引需要 `VOYAGE_API_KEY`。

## 5. 工程结构规范

推荐结构：

```text
src/
  cli/
    index.ts
    commands/
      source.ts
      note.ts
      answer.ts

  domain/
    candidate.ts
    source.ts
    note.ts
    index-entry.ts
    ids.ts
    states.ts
    validators.ts

  storage/
    paths.ts
    json-store.ts
    candidate-repo.ts
    source-repo.ts
    note-repo.ts
    index-repo.ts

  workflows/
    ingest-markdown-workflow.ts
    process-source-workflow.ts
    understand-source-workflow.ts
    discuss-source-workflow.ts
    approve-source-workflow.ts
    compose-note-workflow.ts
    approve-note-workflow.ts
    answer-question-workflow.ts

  ingest/
    ingest-markdown.ts
    ingest-pdf.ts
    candidate-to-source.ts

  processing/
    process-source.ts
    markdown-processor.ts
    pdf-processor.ts
    segmenter.ts

  agents/
    llm-client.ts
    understand-agent.ts
    discussion-agent.ts
    note-agent.ts
    answer-agent.ts
    prompts/
      draft-understanding.md
      discussion-reply.md
      discussion-summary-update.md
      compose-note-json.md
      answer-grounded.md

  discussion/
    append-message.ts
    summarize-discussion.ts
    convergence.ts

  notes/
    compose-note.ts
    render-markdown.ts
    templates.ts

  qa/
    note-lint.ts

  indexing/
    build-index-entry.ts
    retrieve.ts

  answer/
    answer-question.ts

  collectors/
    github-trending.ts
    hacker-news.ts
    scorer.ts
    dedupe.ts

  utils/
```

P0 不需要一次性实现所有目录。P0 应优先实现主动导入学习闭环相关模块。

## 6. 分层职责

### 6.1 CLI 层

CLI 是系统的主要用户入口，但只作为交互壳，不承载核心业务逻辑。

CLI 负责：

- 参数解析。
- 用户交互。
- 输出结果摘要。
- 调用 workflow。
- 将 workflow 错误转换为可读提示。
- 在交互式 `discuss` 中读取用户输入。

CLI 不负责：

- 直接读写核心 JSON。
- 直接调用 LLM。
- 直接修改状态。
- 直接拼接知识对象路径。
- 直接执行 schema 校验细节。
- 直接生成 Note、Markdown 或 Index。

#### CLI 命令结构

P0 采用资源化命令结构：

```text
ai-knowledge source ...
ai-knowledge note ...
ai-knowledge answer ...
```

采用资源化结构的原因：

- `source approve` 与 `note approve` 语义清晰，不混淆。
- 后续扩展 `source list/show`、`note list/show` 更自然。
- CLI 命令与领域对象边界保持一致。

#### CLI 与 Workflow 契约

每个非交互 CLI 命令默认只调用一个 workflow。

Workflow 返回统一结果结构：

```ts
type WorkflowResult<T> =
  | {
      ok: true;
      data: T;
      next_actions?: NextAction[];
    }
  | {
      ok: false;
      error: WorkflowError;
      next_actions?: NextAction[];
    };

export type NextAction = {
  label: string;
  command: string;
};
```

CLI 负责展示 `next_actions`，但不自行推导下一步业务动作。

#### CLI 输出规范

默认输出为人类可读文本。所有非交互命令应支持 `--json`，用于脚本化调用。

错误输出统一包含：

```text
Cannot <action>:
  reason: ...
  current_status: ...
  expected_status: ...
  missing:
    - ...

Next:
  ...
```

建议退出码：

```text
0 success
1 general workflow failure
2 invalid CLI usage
3 validation failure
4 state transition rejected
5 external or LLM failure
```

### 6.2 Domain 层

Domain 层是系统的规则内核，只负责对象契约、状态规则和纯校验。

Domain 层负责：

- `Candidate`、`Source`、`Note`、`IndexEntry` 的 Zod schema 与 TypeScript type。
- 状态枚举。
- 对象级 validator。
- ID 与 slug 生成。
- 时间格式辅助函数。
- 状态机。
- 领域错误类型。

Domain 层不得访问文件系统、不得调用 LLM、不得依赖 CLI、不得处理 Markdown。

#### 目录组织

Domain 层采用对象内聚的组织方式：对象文件内部放置该对象的 schema、type、状态枚举和对象级 validator。

推荐结构：

```text
src/domain/
  candidate.ts
  source.ts
  note.ts
  index-entry.ts
  ids.ts
  slug.ts
  time.ts
  state-machine.ts
  errors.ts
```

P0 必须实现：

- `source.ts`
- `note.ts`
- `index-entry.ts`
- `candidate.ts` 的 schema/type，但不接入 workflow
- `ids.ts`
- `slug.ts`
- `time.ts`
- `state-machine.ts`
- `errors.ts`

#### 字段命名规范

TS 核心对象字段与 JSON 字段一致，统一使用 `snake_case`。

```ts
export const DraftUnderstandingSchema = z.object({
  summary: z.string(),
  key_points: z.array(z.string()),
  uncertainties: z.array(z.string()),
  discussion_starters: z.array(z.string()),
  generated_at: IsoDatetimeSchema,
});

export type DraftUnderstanding = z.infer<typeof DraftUnderstandingSchema>;
```

不要在 TS 内部改用 camelCase 后再做映射，避免主对象契约漂移。

#### Zod Schema 策略

每个对象文件应导出 Zod schema，并由 schema 推导 TypeScript type：

```ts
export const SourceSchema = z.object(...);
export type Source = z.infer<typeof SourceSchema>;
```

不要手写一份 type 再手写一份 schema。

运行时校验规则：

- 读 JSON 后必须 parse。
- 写 JSON 前必须 parse。
- workflow 状态流转后必须 parse。
- LLM 输出进入 workflow 前必须 parse。

#### Source Domain 约定

`Source` 是 P0 最重要的对象。

P0 Source 至少包含：

- `id`
- `title`
- `status`
- `ingest_type`
- `content_type`
- `origin`
- `origin_candidate_id`
- `url`
- `author`
- `published_at`
- `ingested_at`
- `updated_at`
- `processing_artifacts`
- `draft_understanding`
- `discussion_summary`
- `note_ids`
- `last_error`

P0 只使用：

```text
ingest_type = upload_markdown
content_type = document
origin.type = user_import
origin.user_input_type = markdown
```

但 enum 可以提前包含 schema 中已有的未来值，例如 `upload_pdf`、`lark_doc`、`candidate_selected`。

`draft_understanding` 在生成前允许为 `null`。

`processing_artifacts` 在未处理阶段允许为空对象 `{}`，处理完成后必须至少包含：

- `clean_text`
- `segments`
- `metadata`

`discussion_summary` 在 Source 创建时初始化，`summary_version = 0` 可表示尚未真实讨论。

`last_error` 为可选字段，用于记录最近一次流程失败；它不进入 Note 或 Index。

Source validator 至少检查：

- `origin.type = candidate` 时，`origin_candidate_id` 必须非空。
- `origin.type = user_import` 时，`origin_candidate_id` 必须为 `null`。
- `status = processed` 及之后，标准 `processing_artifacts` 必须存在。
- `status = understanding_ready` 及之后，`draft_understanding` 必须存在。
- `discussion_summary.ready_for_approval = true` 时，`confirmed_points` 至少一个。
- `status = approved_for_note` 时，讨论必须 ready 且 `confirmed_points` 非空。
- `status = noted` 时，`note_ids` 至少一个。
- `status = failed` 时，`last_error` 必须存在。

#### Note Domain 约定

`Note.status` 枚举：

```text
draft
approved
archived
superseded
```

`approved_at` 在 draft 阶段允许为 `null`；`status = approved` 时必须非空。

`quality_checks` 使用非 null 默认值，`last_checked_at` 允许为 `null`：

```json
{
  "status": "failed",
  "template_complete": false,
  "source_links_present": false,
  "empty_sections": [],
  "last_checked_at": null
}
```

Note validator 至少检查：

- `version >= 1`。
- `root_note_id` 非空。
- v1 Note 的 `root_note_id` 应等于自身 `id`。
- `source_refs` 至少一个。
- `approval_context.source_id` 非空。
- `approval_context.approved_from_summary_version >= 1`。
- `status = approved` 时：
  - `approved_at` 非空。
  - `quality_checks.status = passed`。
  - `conclusions` 非空。
  - `why_it_matters` 非空。
  - `source_refs` 非空。
- `status = superseded` 时，`superseded_by_note_id` 必须非空。
- `supersedes_note_id` 与 `superseded_by_note_id` 不能相同。

#### Index Entry Domain 约定

P0 只索引 approved Note。

Index Entry validator 至少检查：

- `status` 只能为 `approved`。
- `note_id` 非空。
- `approved_at` 非空。
- `summary` 非空。
- `keywords` 字段必须存在，可为空数组。
- `vector_ref` 在 P0 可为 `null`。

#### Candidate Domain 约定

P0 只实现 Candidate schema/type，不接入 workflow。

Candidate validator 至少检查：

- `status = converted` 时，`converted_source_id` 必须非空。
- `score.total` 应等于 breakdown 汇总。
- `score.breakdown` 固定包含 `relevance`、`learning_value`、`novelty`、`discussability`。
- 每个 score 子项范围为 0-3。
- `source_type` 只能为 schema 允许值，例如 `github_trending`、`hacker_news`。

#### ID、Slug 与时间规范

ID / path 日期使用配置时区下的本地日期，默认 `Asia/Shanghai`。

对象时间字段使用 ISO 8601 UTC 字符串。

Domain 提供：

```ts
now_utc_iso()
format_local_date_for_id(date, timezone)
format_local_year_month(date, timezone)
create_candidate_id(date, source_type, slug)
create_source_id(date, ingest_type, slug)
create_note_id(date, slug, version?)
```

如果 ID 或路径冲突，追加短 hash：

```text
src_20260508_upload_markdown_context-engineering_a1b2c3
```

P0 slug 规则：

- lowercase
- trim
- 空格转 `-`
- 移除明显不适合文件名的特殊符号
- 连续 `-` 合并
- 最大长度 60
- 允许中文，不引入拼音依赖

#### State Machine 约定

状态变化必须通过 `state-machine.ts`。

Source P0 状态流转：

```text
ingested -> processing
processing -> processed
processing -> failed
processed -> understanding_ready
processed -> failed
understanding_ready -> discussing
discussing -> approved_for_note
discussing -> failed
approved_for_note -> noted
noted -> archived
failed -> processing
failed -> processed
```

`failed` 重试在 P0 保持简单，只允许回到明确步骤，由 workflow 根据失败阶段选择目标状态。

Note 状态流转：

```text
draft -> approved
draft -> archived
approved -> superseded
approved -> archived
```

Candidate 状态流转可先定义但 P0 不接入 workflow：

```text
new -> recommended
new -> dismissed
recommended -> selected
recommended -> dismissed
selected -> converted
```

#### Domain Error

Domain 层定义统一错误类型：

```ts
type DomainErrorCode =
  | 'VALIDATION_FAILED'
  | 'INVALID_STATE_TRANSITION'
  | 'INVARIANT_VIOLATION'
  | 'INVALID_ID'
  | 'INVALID_SLUG';

class DomainError extends Error {
  code: DomainErrorCode;
  details?: unknown;
}
```

workflow 捕获 DomainError 后转换为 workflow error，CLI 再负责展示。

### 6.3 Storage 层

Storage 层是本地文件系统适配层，只负责对象如何落盘和读取。

Storage 层负责：

- 根据对象 id / 日期 / slug 生成路径。
- 创建目录。
- 读写 JSON。
- 追加写入 `discussion.jsonl`。
- 保存 raw 文件。
- 保存 processed artifacts。
- 遍历对象目录用于 list/show。
- 保证写入格式稳定。
- 保证对象内部路径引用相对对象目录。

Storage 层不负责：

- 不做状态流转判断。
- 不做业务 invariant 校验。
- 不调用 LLM。
- 不处理 Markdown 内容语义。
- 不判断 Note 能否 approved。
- 不生成 ID 或 slug。

#### Storage 目录组织

推荐结构：

```text
src/storage/
  config.ts
  paths.ts
  json-store.ts
  object-locator.ts
  source-repo.ts
  note-repo.ts
  index-repo.ts
  artifact-store.ts
  discussion-log.ts
```

P0 暂不实现 `candidate-repo.ts`。

职责划分：

- `config.ts`：解析 storage 相关配置，默认 `knowledge_dir = ./knowledge`。
- `paths.ts`：唯一的路径生成入口。
- `json-store.ts`：底层 JSON 读写、格式化、原子写入、Zod shape parse。
- `object-locator.ts`：根据 id 定位对象目录或文件。
- `source-repo.ts`：Source 对象读写与列表。
- `note-repo.ts`：Note 对象与 Markdown 读写。
- `index-repo.ts`：Index Entry 读写与列表。
- `artifact-store.ts`：Source raw / processed artifact 文件读写。
- `discussion-log.ts`：`discussion.jsonl` append 与读取。

#### 路径规范

MVP 路径布局遵守 `specs/schema.md`：

```text
knowledge/
  candidates/YYYY/MM/cand_xxx.json
  sources/YYYY/MM/src_xxx/source.json
  sources/YYYY/MM/src_xxx/discussion.jsonl
  sources/YYYY/MM/src_xxx/raw/
  sources/YYYY/MM/src_xxx/processed/
  notes/YYYY/MM/note_xxx/note.json
  notes/YYYY/MM/note_xxx/note.md
  index/YYYY/MM/note_xxx.index.json
```

所有路径必须从 workspace root 或配置的 `knowledge_dir` 解析。

对象路径只能由 `storage/paths.ts` 生成，业务模块不得自行拼接 `knowledge/` 路径。

Storage 不自己决定日期。Storage 从对象 id 中解析日期：

```text
src_20260509_upload_markdown_xxx -> 2026/05
note_20260509_xxx -> 2026/05
cand_20260509_xxx -> 2026/05
```

#### 路径安全

Storage 必须防止 path traversal：

- 不接受包含 `..` 的 artifact relative path。
- 不允许 absolute artifact path 写入对象目录。
- raw 文件保存时只使用 basename 或显式 target name。
- 最终写入路径必须确认仍在对应 source/note 目录下。

#### Object Locator

对象定位采用“从 id 日期推导 + fallback 扫描”。

优先从 id 日期推导路径：

```text
src_20260509_xxx -> knowledge/sources/2026/05/src_20260509_xxx/
note_20260509_xxx -> knowledge/notes/2026/05/note_20260509_xxx/
```

如果推导路径不存在，则 fallback 扫描对应对象根目录。

找不到对象时抛 `StorageError`，不要返回 `null` 后让上层猜测。

#### JSON 读写规范

JSON 文件统一：

```text
UTF-8
2 spaces indentation
末尾换行
```

写出格式：

```ts
JSON.stringify(data, null, 2) + '\n'
```

JSON 写入必须使用原子写入：

```text
write temp file in same directory -> rename
```

如果写入失败，应清理临时文件并抛出 `StorageError`。

Storage 可以做 Zod shape parse：

- 读 JSON 后 parse。
- 写 JSON 前 parse。

Storage 不做业务 invariant validation。业务 invariant 由 domain / workflow 负责。

#### JSONL 规范

`discussion.jsonl` 是 append-only。

每行至少包含：

```json
{
  "role": "user",
  "content": "...",
  "created_at": "2026-05-09T10:00:00Z"
}
```

可选包含：

```json
{
  "metadata": {}
}
```

规则：

- 每条消息一行 JSON。
- append-only，不重写旧消息。
- 空文件读取为 `[]`。
- 读取时按文件顺序返回消息。
- 任意一行 parse 失败应直接报错，不静默跳过。

#### Repository 接口

`SourceRepo`：

```ts
export type SourceListFilter = {
  status?: SourceStatus;
};

export interface SourceRepo {
  create_source(input: {
    source: Source;
    raw_file_path?: string;
    raw_file_name?: string;
  }): Promise<Source>;

  get_source(source_id: string): Promise<Source>;
  save_source(source: Source): Promise<void>;
  list_sources(filter?: SourceListFilter): Promise<Source[]>;
  source_exists(source_id: string): Promise<boolean>;
}
```

`NoteRepo`：

```ts
export type NoteListFilter = {
  status?: NoteStatus;
};

export interface NoteRepo {
  create_note(input: {
    note: Note;
    markdown: string;
  }): Promise<Note>;

  get_note(note_id: string): Promise<Note>;
  save_note(note: Note): Promise<void>;
  get_note_markdown(note_id: string): Promise<string>;
  save_note_markdown(note_id: string, markdown: string): Promise<void>;
  list_notes(filter?: NoteListFilter): Promise<Note[]>;
  note_exists(note_id: string): Promise<boolean>;
}
```

`IndexRepo`：

```ts
export interface IndexRepo {
  save_index_entry(entry: IndexEntry): Promise<void>;
  get_index_entry(note_id: string): Promise<IndexEntry>;
  list_index_entries(): Promise<IndexEntry[]>;
}
```

#### Artifact Store

P0 raw Markdown 固定保存为：

```text
raw/original.md
```

P0 processed artifacts 固定三件套：

```text
processed/clean_text.md
processed/segments.json
processed/metadata.json
```

ArtifactStore 写入后返回相对 Source 目录的路径，例如：

```text
processed/clean_text.md
```

Storage 不主动修改 `source.json.processing_artifacts`，由 workflow 接收返回路径后更新 Source。

#### List 策略

P0 list 使用 Node fs 递归遍历，不依赖 shell glob。

规则：

- `list_sources` 默认按 `updated_at desc`。
- `list_notes` 默认按 `updated_at desc`。
- `list_index_entries` 默认按 `approved_at desc`。
- 不符合约定的文件忽略。
- 符合约定但 JSON parse 失败时应报错，避免数据损坏被隐藏。

#### Init 支持

P0 支持：

```bash
ai-knowledge init
```

行为：

- 创建 `knowledge/candidates/`、`knowledge/sources/`、`knowledge/notes/`、`knowledge/index/`。
- 如果目录已存在，不报错。
- 不创建示例数据。
- 不覆盖已有文件。

即使支持 `init`，repo 写入时也应确保父目录存在。

#### Storage Error

Storage 层定义统一错误：

```ts
type StorageErrorCode =
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'INVALID_PATH'
  | 'READ_FAILED'
  | 'WRITE_FAILED'
  | 'JSON_PARSE_FAILED'
  | 'SCHEMA_PARSE_FAILED';

class StorageError extends Error {
  code: StorageErrorCode;
  path?: string;
  details?: unknown;
}
```

workflow 捕获 StorageError 后转换为 workflow error，CLI 再负责展示。

### 6.4 Workflow 层

Workflow 层负责端到端业务编排，是唯一可以组合 domain、storage、processing、agents、qa、indexing 的层。

Workflow 层负责：

- 读取当前对象。
- 校验当前对象。
- 检查前置状态。
- 调用 processor / agent / renderer / qa / indexing。
- 调用 domain state machine 执行状态流转。
- 更新对象字段。
- 保存对象。
- 生成 `next_actions`。
- 捕获 domain / storage / agent / processor 错误并转换为 workflow error。
- 必要时写入 `Source.last_error`。

Workflow 层不负责：

- 不直接拼路径。
- 不直接读写 JSON 文件。
- 不自己实现 schema 校验规则。
- 不自己实现 Markdown 解析细节。
- 不自己实现 LLM prompt。
- 不直接打印 CLI 输出。
- 不吞掉错误。

#### Workflow 目录组织

P0 推荐结构：

```text
src/workflows/
  types.ts
  errors.ts
  init-workflow.ts
  ingest-markdown-workflow.ts
  process-source-workflow.ts
  understand-source-workflow.ts
  discuss-source-workflow.ts
  approve-source-workflow.ts
  compose-note-workflow.ts
  render-note-workflow.ts
  lint-note-workflow.ts
  approve-note-workflow.ts
  index-note-workflow.ts
  answer-question-workflow.ts
  list-sources-workflow.ts
  show-source-workflow.ts
  list-notes-workflow.ts
  show-note-workflow.ts
```

每个 CLI 命令基本对应一个 workflow。

#### WorkflowResult

Workflow 统一返回：

```ts
type WorkflowResult<T> =
  | {
      ok: true;
      data: T;
      next_actions?: NextAction[];
    }
  | {
      ok: false;
      error: WorkflowError;
      next_actions?: NextAction[];
    };

export type NextAction = {
  label: string;
  command: string;
};
```

Workflow error：

```ts
type WorkflowErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'INVALID_STATE'
  | 'PROCESSING_FAILED'
  | 'AGENT_FAILED'
  | 'QA_FAILED'
  | 'STORAGE_FAILED'
  | 'PARTIAL_FAILURE'
  | 'UNKNOWN';

type WorkflowError = {
  code: WorkflowErrorCode;
  message: string;
  details?: unknown;
  cause?: unknown;
};
```

不要把原始 Error 直接暴露给 CLI 输出，但可以保留在 `cause` 中用于 debug。

#### 通用执行模式

会改变状态的 workflow 应遵循：

```text
1. Load object
2. Validate current object
3. Check expected state
4. Run operation
5. Validate operation output
6. Update object fields
7. Transition state through domain state-machine
8. Validate updated object
9. Persist object
10. Return WorkflowResult + next_actions
```

状态变化必须通过 domain state machine，不得直接赋值。

#### 失败处理

Source 相关 workflow 失败时：

- 尽可能写入 `source.last_error`。
- processing / understanding 阶段失败应将 Source 转为 `failed`。
- discussion 单轮 agent 失败时保持 `discussing`，写入 `last_error`，允许用户重试。
- 返回 `WorkflowResult.ok = false`。

Note 相关 workflow 失败时：

- `lint` 失败写入 `quality_checks.status = failed`。
- compose / render / storage 失败返回 workflow error。
- 不擅自修改 Note 状态。

LLM 输出 schema 校验失败时：

- workflow 失败。
- Source 相关场景写入对应 `last_error.stage`。
- 不进入下一状态。
- 不静默修复。

#### Workflow Error 转换

错误映射：

- `DomainError` -> `VALIDATION_FAILED` 或 `INVALID_STATE`
- `StorageError.NOT_FOUND` -> `NOT_FOUND`
- 其他 `StorageError` -> `STORAGE_FAILED`
- `AgentError` -> `AGENT_FAILED`
- `ProcessorError` -> `PROCESSING_FAILED`
- QA 未通过 -> `QA_FAILED`
- 多文件写入出现部分成功 -> `PARTIAL_FAILURE`

#### 本地文件事务边界

P0 不实现复杂事务系统。

规则：

- 单文件写入依赖 storage 原子写。
- 多文件 workflow 只保证尽量有序。
- 创建 Source 失败时，storage 可清理刚创建的半成品目录。
- Note 创建成功但 Source 更新失败时，返回 `PARTIAL_FAILURE`。
- 不做复杂 rollback 系统。

#### P0 Workflow 明细

##### init_workflow

对应命令：

```bash
ai-knowledge init
```

职责：创建 `knowledge/candidates/`、`knowledge/sources/`、`knowledge/notes/`、`knowledge/index/`。

规则：幂等、不创建示例数据、不覆盖已有文件。

##### ingest_markdown_workflow

对应命令：

```bash
ai-knowledge source ingest markdown <file>
```

流程：

1. 检查输入文件存在。
2. 从文件名或 frontmatter 提取 title。
3. 生成 slug 和 source id。
4. 创建 `Source.status = ingested`。
5. 设置 `ingest_type = upload_markdown`、`content_type = document`、`origin.type = user_import`。
6. 初始化 `processing_artifacts = {}`、`draft_understanding = null`、`discussion_summary.summary_version = 0`。
7. 保存 raw 文件到 `raw/original.md`。
8. 创建空 `discussion.jsonl`。
9. 保存 `source.json`。

下一步：`ai-knowledge source process <source_id>`。

##### process_source_workflow

对应命令：

```bash
ai-knowledge source process <source_id>
```

前置状态：`Source.status = ingested`。

流程：

1. Load Source。
2. Transition `ingested -> processing` 并保存。
3. 读取 `raw/original.md`。
4. Markdown processor 生成 `clean_text`、`segments`、`metadata`。
5. 写入 processed 三件套。
6. 更新 `processing_artifacts`。
7. 清除 `last_error`。
8. Transition `processing -> processed`。
9. 保存 Source。

失败：transition 到 `failed`，写入 `last_error.stage = processing`。

下一步：`ai-knowledge source understand <source_id>`。

##### understand_source_workflow

对应命令：

```bash
ai-knowledge source understand <source_id>
```

前置状态：`Source.status = processed`。

流程：

1. Load Source。
2. 读取 processed artifacts。
3. 可选检索相关 approved Note 摘要。
4. 调用 `understand_agent`。
5. Zod parse `draft_understanding`。
6. 写入 `source.draft_understanding`。
7. 清除 `last_error`。
8. Transition `processed -> understanding_ready`。
9. 保存 Source。

失败：transition 到 `failed`，写入 `last_error.stage = understanding`。

下一步：`ai-knowledge source discuss <source_id>`。

##### discuss_source_workflow

对应命令：

```bash
ai-knowledge source discuss <source_id>
```

该 workflow 被 REPL 每轮调用。

输入：

```ts
{
  source_id: string;
  user_message: string;
}
```

前置状态：`understanding_ready | discussing`。

流程：

1. Load Source。
2. 如果当前是 `understanding_ready`，先 transition 到 `discussing`。
3. Append user message 到 `discussion.jsonl`。
4. 读取 Source metadata、draft_understanding、discussion_summary、recent messages 和必要 artifact 摘要。
5. 调用 discussion agent。
6. Zod parse agent output。
7. Append assistant message 到 `discussion.jsonl`。
8. 更新 `discussion_summary`。
9. 保存 Source。

discussion agent 单轮失败时：不转 `failed`，保持 `discussing`，写入 `last_error.stage = discussion`。

如果 ready，下一步：`ai-knowledge source approve <source_id>`。

##### approve_source_workflow

对应命令：

```bash
ai-knowledge source approve <source_id>
```

前置条件：

- `Source.status = discussing`
- `discussion_summary.ready_for_approval = true`
- `confirmed_points` 非空

流程：

1. Load Source。
2. Validate discussion_summary。
3. Transition `discussing -> approved_for_note`。
4. 设置 `discussion_summary.discussion_status = closed`。
5. 保存 Source。

不允许强制 approve。

下一步：`ai-knowledge note compose <source_id>`。

##### compose_note_workflow

对应命令：

```bash
ai-knowledge note compose <source_id>
```

前置状态：`Source.status = approved_for_note`。

流程：

1. Load Source。
2. 按需读取 discussion messages。
3. 调用 note agent 生成 Note draft。
4. Zod parse Note draft。
5. 根据 Note 渲染 Markdown。
6. 创建 Note 目录并写入 `note.json`、`note.md`。
7. 更新 Source：`note_ids.push(note.id)`。
8. Transition `approved_for_note -> noted`。
9. 保存 Source。

如果 note agent 失败，Source 保持 `approved_for_note`，写入 `last_error.stage = compose_note`。

如果 Note 已创建但 Source 更新失败，返回 `PARTIAL_FAILURE`。

下一步：`ai-knowledge note lint <note_id>`。

##### render_note_workflow

对应命令：

```bash
ai-knowledge note render <note_id>
```

前置状态：`Note.status = draft | approved`。

流程：Load Note -> render markdown -> save `note.md`。

不改变 Note 状态。允许对 approved Note 执行，因为 render 只刷新视图，不改变主真相。

##### lint_note_workflow

对应命令：

```bash
ai-knowledge note lint <note_id>
```

P0 前置状态：`Note.status = draft`。

流程：

1. Load Note。
2. Load `note.md`。
3. Run note_lint。
4. Update `quality_checks`。
5. Save Note。

通过则下一步：`ai-knowledge note approve <note_id>`。

失败则返回 QA 失败列表。

##### approve_note_workflow

对应命令：

```bash
ai-knowledge note approve <note_id>
```

前置条件：

- `Note.status = draft`
- `quality_checks.status = passed`

流程：

1. Load Note。
2. Transition `draft -> approved`。
3. Set `approved_at = now`。
4. Save Note。

下一步：`ai-knowledge note index <note_id>`。

##### index_note_workflow

对应命令：

```bash
ai-knowledge note index <note_id>
```

前置状态：`Note.status = approved`。

流程：

1. Load Note。
2. Build Index Entry：`summary`、`keywords`、`tags`、`status = approved`、`vector_ref = null`。
3. Save Index Entry。

P0 不做 vector embedding。

##### answer_question_workflow

对应命令：

```bash
ai-knowledge answer "<question>"
```

P0 只基于 approved Notes 回答，不 fallback 到 Source。

流程：

1. List Index Entries。
2. Keyword / metadata retrieve top-k。
3. Load corresponding approved Notes。
4. 调用 answer agent 生成 grounded answer。
5. 返回结构化 answer。

如果没有 approved Note 命中，应明确说明没有相关已确认知识。

##### list/show workflows

只读，不改状态。

- `list_sources_workflow`：支持 status filter，默认 `updated_at desc`。
- `show_source_workflow`：展示 Source 当前工作状态，不默认读取完整 artifact 正文。
- `list_notes_workflow`：支持 status filter，默认 `updated_at desc`。
- `show_note_workflow`：展示 Note 摘要状态，不默认输出完整 `note.md`。

### 6.5 Agent 层

Agent 层是 LLM 调用适配层，只负责生成结构化候选内容。

Agent 层负责：

- 生成 `draft_understanding` 候选。
- 生成 discussion reply。
- 生成 `discussion_summary` update 候选。
- 生成 `note.json` 候选内容。
- 生成 grounded answer 候选。
- 输出不确定性、引用依据和建议下一步。

Agent 层不负责：

- 不读写文件。
- 不修改 Source / Note / Candidate 状态。
- 不创建 Index Entry。
- 不决定是否 approved。
- 不决定是否进入主知识库。
- 不绕过 Zod 校验。
- 不直接访问 storage repo。
- 不直接打印 CLI 输出。

LLM 可以提出建议，但状态变化由 workflow 根据规则决定。

#### Agent 目录组织

P0 推荐结构：

```text
src/agents/
  llm-client.ts
  types.ts
  errors.ts
  understand-agent.ts
  discussion-agent.ts
  note-agent.ts
  answer-agent.ts
  prompts/
    draft-understanding.md
    discussion-reply.md
    compose-note-json.md
    answer-grounded.md
```

P0 不使用复杂 multi-agent framework。每个 agent 是一个函数，封装一次或少数几次 LLM 调用。

#### LLM Client

P0 使用 Anthropic TypeScript SDK，通过 Anthropic-compatible endpoint 调用模型。

客户端配置：

```ts
import Anthropic from '@anthropic-ai/sdk';

export const client = new Anthropic({
  apiKey: process.env.GATEWAY_API_KEY,
  baseURL: 'https://api.deepseek.com/anthropic',
});
```

P0 默认模型：

```text
deepseek-v4-pro
```

配置约定：

```ts
type ModelConfig = {
  provider: 'anthropic_compatible';
  base_url: 'https://api.deepseek.com/anthropic';
  api_key_env: 'GATEWAY_API_KEY';
  default_model: 'deepseek-v4-pro';
  understand_model?: string;
  discussion_model?: string;
  note_model?: string;
  answer_model?: string;
};
```

API key 必须从 `process.env.GATEWAY_API_KEY` 获取，不得写入配置文件或仓库。

#### LLM Client 接口

P0 至少提供：

```ts
export interface LlmClient {
  generate_text(input: GenerateTextInput): Promise<GenerateTextResult>;
  generate_json<T>(input: GenerateJsonInput<T>): Promise<T>;
}
```

核心 Agent 尽量使用 `generate_json`。

`generate_json` 必须接收 Zod schema，并在返回前完成校验：

```ts
generate_json<T>({
  system_prompt,
  user_prompt,
  schema,
  model,
  temperature,
}): Promise<T>
```

#### 结构化输出规则

Agent 输出必须结构化，并经 Zod 校验。

系统字段由 workflow 补充，不由模型生成，例如：

- `id`
- `status`
- `created_at`
- `updated_at`
- `generated_at`
- `approved_at`
- `summary_version`
- `quality_checks`

例如 Understand Agent 只输出语义字段：

```json
{
  "summary": "...",
  "key_points": [],
  "uncertainties": [],
  "discussion_starters": []
}
```

workflow 再补 `generated_at`。

#### Prompt 文件化

所有 prompt 必须放在：

```text
src/agents/prompts/
```

P0 prompt 文件：

```text
draft-understanding.md
discussion-reply.md
compose-note-json.md
answer-grounded.md
```

Prompt 属于产品逻辑，必须进入版本管理。

#### Prompt 设计标准

本项目中的好 prompt 不是让模型“写得漂亮”，而是让模型稳定地产出可校验、可追溯、不越权的中间对象。

通用标准：

```text
边界清楚、输入清楚、输出固定、禁止越权、显式不确定、可被校验
```

Prompt 必须做到：

- 明确当前 workflow 阶段。
- 明确模型当前角色。
- 明确输入材料及其可信层级。
- 明确输出 JSON schema。
- 明确禁止事项。
- 显式要求列出不确定性。
- 要求模型保持保守，宁可少写也不要生成未支持的推断。
- 能与对应 Zod schema 一一校验。

#### Prompt 文件统一结构

每个 prompt 文件应采用以下结构：

```md
# Role

当前 Agent 的角色，以及处于哪个 workflow 阶段。

# Goal

本次要产出的对象或候选内容。

# Input

会收到哪些输入，每类输入的含义，以及可信级别。

# Rules

必须遵守的规则。

# Do Not

明确禁止事项。

# Output Schema

必须输出的 JSON 结构。

# Quality Bar

什么样的输出合格，什么样的输出不合格。
```

#### 知识可信层级

Prompt 必须显式体现知识分层。默认可信度从高到低：

```text
approved Note > confirmed_points > draft_understanding > raw/processed source
```

不同 Agent 使用不同层级：

- Understand Agent 可以基于 raw / processed source 生成草稿。
- Discussion Agent 可以结合 draft 和用户反馈推进理解。
- Note Agent 只能把 confirmed discussion 写成正式 Note 候选。
- Answer Agent 只能把 approved Notes 当作 P0 主依据。

Prompt 不得让模型把 raw material、draft、用户讨论和 approved Note 混成同等事实。

#### Prompt 与 Zod Schema

每个 prompt 必须对应一个 Zod 输出 schema：

```text
draft-understanding.md      -> DraftUnderstandingCandidateSchema
discussion-reply.md         -> DiscussionAgentOutputSchema
compose-note-json.md        -> NoteCandidateSchema
answer-grounded.md          -> GroundedAnswerSchema
```

Prompt 负责说明模型应输出什么；Zod 负责验证模型是否做到。

如果 schema parse 失败，应抛出：

```text
AgentError: LLM_OUTPUT_SCHEMA_FAILED
```

不得静默修复后继续 workflow。

#### Prompt 输入组织

Agent user prompt 应使用结构化分区，不要把所有输入混成一段自然语言。

推荐使用 Markdown 分区 + JSON code block：

```md
## Source Title

...

## Draft Understanding

```json
...
```

## Discussion Summary

```json
...
```

## Recent Messages

```json
...
```
```

动态信息如时间、request id、运行时状态不得写入稳定 system prompt。需要时放入 user input 区域，避免破坏未来 prompt caching 的稳定性。

#### Prompt 禁止事项

所有 prompt 都应包含与当前阶段相关的 `Do Not`。通用禁止事项：

- 不得把草稿伪装成已确认知识。
- 不得把不确定性升级成结论。
- 不得新增未由输入支持的事实。
- 不得伪造 source_refs 或 evidence_refs。
- 不得把模型常识包装成知识库结论。
- 不得隐藏“没有足够已确认知识”的情况。

#### Draft Understanding Prompt 质量标准

`draft-understanding.md` 应强调：

- 输出是讨论前草稿，不是最终结论。
- `key_points` 应是值得讨论的要点，不是泛泛摘要。
- `uncertainties` 必须具体。
- `discussion_starters` 应是能引发用户判断的问题，不是“你怎么看？”这类空泛问题。
- 如果 `input_truncated = true`，必须指出材料可能未完整覆盖。

#### Discussion Prompt 质量标准

`discussion-reply.md` 应强调：

- 回复应推动理解收敛，而不是客服式附和。
- 如果用户反馈推翻 draft，应更新理解，不要防守原草稿。
- 如果用户给出明确价值判断，可作为 confirmed point 候选。
- 每轮 `next_prompts` 最多 3 个。
- `assistant_message` 应聚焦，不要过长。
- `ready_for_approval` 只是建议，最终由 workflow 判断。

#### Note Compose Prompt 质量标准

`compose-note-json.md` 是最严格的 prompt。

必须强调：

- `conclusions` 只能来自 `discussion_summary.confirmed_points`。
- 不得把 `open_questions` 或 `unresolved_issues` 升级成结论。
- 不得从 source material 中新增讨论未确认的结论。
- `why_it_matters` 应来自讨论中的价值判断。
- `source_refs` 只能从输入中选择。
- Prefer a shorter Note over an unsupported Note.

#### Answer Prompt 质量标准

`answer-grounded.md` 必须强调：

- P0 只能基于 approved Notes 回答。
- 不 fallback 到 Source。
- 不使用模型背景知识补充为项目知识库结论。
- 没有命中相关 approved Note 时，必须明确说没有足够已确认知识。
- `unconfirmed_materials` 在 P0 应为空数组。

#### Prompt Review Checklist

通用 checklist：

- 是否说明当前 workflow 阶段？
- 是否说明输入可信层级？
- 是否说明不能越权？
- 是否有固定 JSON 输出？
- 是否要求列出不确定性？
- 是否禁止新增未确认结论？
- 是否说明宁可少写，不要无依据补全？
- 是否能被 Zod schema 校验？
- 是否避免动态时间 / 随机信息污染 system prompt？

Note prompt 额外检查：

- `conclusions` 是否只能来自 `confirmed_points`？
- `open_questions` 是否不会被升级成结论？
- `source_refs` 是否只能来自输入？
- 是否禁止引入模型常识？

Answer prompt 额外检查：

- 是否只基于 approved Notes？
- 没有命中时是否明确说明不知道？
- 是否禁止把模型常识包装成知识库结论？

#### Understand Agent

文件：

```text
understand-agent.ts
prompts/draft-understanding.md
```

输入：

```ts
type UnderstandAgentInput = {
  source_title: string;
  source_metadata: unknown;
  clean_text?: string;
  segments: Segment[];
  related_notes?: RetrievedNoteSummary[];
  input_truncated: boolean;
};
```

输出：

```ts
type DraftUnderstandingCandidate = {
  summary: string;
  key_points: string[];
  uncertainties: string[];
  discussion_starters: string[];
};
```

规则：

- 明确这是草稿，不是最终结论。
- 必须列出不确定性。
- 必须提出讨论切口。
- 不得假装用户已确认。
- 可以参考相关 Note，但不能覆盖当前资料。
- 如果 `input_truncated = true`，必须在不确定性中说明材料可能未完整覆盖。

#### Discussion Agent

P0 使用一次 LLM 调用同时返回 reply 和 summary update。

输入：

```ts
type DiscussionAgentInput = {
  source_title: string;
  draft_understanding: DraftUnderstanding;
  current_discussion_summary: DiscussionSummary;
  recent_messages: DiscussionMessage[];
  user_message: string;
  relevant_segments?: Segment[];
  related_notes?: RetrievedNoteSummary[];
  input_truncated: boolean;
};
```

输出：

```ts
type DiscussionAgentOutput = {
  assistant_message: string;
  discussion_summary_update: {
    confirmed_points: string[];
    open_questions: string[];
    unresolved_issues: string[];
    next_prompts: string[];
    ready_for_approval: boolean;
  };
};
```

workflow 负责：

- append assistant message。
- increment `summary_version`。
- set `last_updated_at`。
- set `discussion_status`。

规则：

- 回复必须推动理解收敛。
- 不能只复述资料。
- 可以质疑用户或资料，但必须给出理由。
- 信息不足时应提出需要补充资料。
- `ready_for_approval` 只是建议，最终能否 approve 由 workflow 判断。

#### Note Agent

文件：

```text
note-agent.ts
prompts/compose-note-json.md
```

输入：

```ts
type NoteAgentInput = {
  source: Source;
  discussion_summary: DiscussionSummary;
  draft_understanding: DraftUnderstanding;
  source_refs: SourceRef[];
  related_notes?: RetrievedNoteSummary[];
};
```

输出：

```ts
type NoteCandidate = {
  title: string;
  conclusions: string[];
  why_it_matters: string[];
  current_understanding: string;
  open_questions: string[];
  related_note_ids: string[];
  source_refs: SourceRef[];
};
```

workflow 负责补充：

- id
- slug
- status
- version
- root_note_id
- timestamps
- approval_context
- render_metadata
- quality_checks

规则：

- `conclusions` 只能基于 `discussion_summary.confirmed_points`。
- 可以润色表达，但不得新增未确认结论。
- 未解决问题进入 `open_questions`。
- 必须保留 `source_refs`。
- evidence refs 必须来自 workflow 输入，不得凭空生成。

#### Answer Agent

文件：

```text
answer-agent.ts
prompts/answer-grounded.md
```

输入：

```ts
type AnswerAgentInput = {
  question: string;
  approved_notes: Note[];
};
```

输出：

```ts
type GroundedAnswer = {
  conclusion: string;
  cited_notes: {
    note_id: string;
    title: string;
    relevant_points: string[];
  }[];
  unconfirmed_materials: [];
  limitations: string[];
};
```

P0 规则：

- 只能基于 approved Notes。
- 不 fallback 到 Source。
- 不补模型常识。
- 没有相关 Note 时明确说明没有已确认知识。

#### Context 管理

P0 不做复杂上下文压缩，采用简单 token budget 截断策略。

规则：

- Agent 输入优先使用 `segments` 和 metadata，而不是无条件塞入完整 `clean_text`。
- 超过预算时截断输入，并设置 `input_truncated = true`。
- Agent 必须在不确定性或 limitations 中反映截断风险。

#### Tool Calling

P0 Agent 不使用 LLM tool calling。

原因：

- Workflow 已经准备好上下文。
- Agent 只负责生成结构化内容。
- 让 LLM 自己调用工具会模糊边界。

后续如需检索更多 Note，也应由 workflow / retrieval 层完成，不由 LLM 直接访问 storage。

#### Temperature

P0 使用可配置 temperature：

```ts
agent_defaults = {
  understand_temperature: 0.2,
  discussion_temperature: 0.4,
  note_temperature: 0.2,
  answer_temperature: 0.1,
};
```

#### Agent Error

Agent 层定义统一错误：

```ts
type AgentErrorCode =
  | 'LLM_CALL_FAILED'
  | 'LLM_OUTPUT_PARSE_FAILED'
  | 'LLM_OUTPUT_SCHEMA_FAILED'
  | 'PROMPT_LOAD_FAILED'
  | 'CONTEXT_TOO_LARGE';

class AgentError extends Error {
  code: AgentErrorCode;
  details?: unknown;
}
```

Workflow 捕获 AgentError 后统一转为 `WorkflowError.code = AGENT_FAILED`，具体 AgentErrorCode 放入 details。

#### Agent 测试

真实 LLM 不进入单元测试。

测试策略：

- Agent 接口可 mock。
- Workflow 测试使用 fake agents。
- Agent schema parse 单独测试。
- Prompt P0 先人工评审或 snapshot，不强制真实调用测试。

## 7. Source.last_error 规范

为支持失败恢复与可观测性，`Source` 允许扩展可选字段 `last_error`。

建议结构：

```json
{
  "last_error": {
    "stage": "processing",
    "message": "Failed to parse markdown frontmatter.",
    "occurred_at": "2026-05-08T10:00:00Z"
  }
}
```

字段说明：

- `stage`：失败阶段，例如 `ingest`、`processing`、`understanding`、`discussion`、`compose_note`、`indexing`。
- `message`：面向开发和用户排查的简短错误信息。
- `occurred_at`：ISO 8601 UTC 时间。

规则：

- 当 Source 进入 `failed` 状态时，应写入 `last_error`。
- 重试成功后，可以清除 `last_error` 或保留为历史字段；P0 默认清除。
- `last_error` 不作为知识内容，不进入 Note 和 Index。

该字段需要同步补充到 `specs/schema.md` 的 Source schema 中。

## 8. P0 主动学习闭环

P0 只实现 Markdown 主动导入，不支持 PDF、自动采集和向量检索。

P0 目标链路：

```text
Markdown -> Source -> Processed Artifacts -> Draft Understanding
-> Discussion Summary -> Approval -> Note JSON -> Note Markdown
-> QA -> Approved Note -> Index Entry -> Answer
```

### 8.1 P0 命令集

P0 采用以下资源化 CLI 命令：

```bash
ai-knowledge source ingest markdown <file>
ai-knowledge source process <source_id>
ai-knowledge source understand <source_id>
ai-knowledge source discuss <source_id>
ai-knowledge source approve <source_id>
ai-knowledge source list
ai-knowledge source show <source_id>

ai-knowledge note compose <source_id>
ai-knowledge note render <note_id>
ai-knowledge note lint <note_id>
ai-knowledge note approve <note_id>
ai-knowledge note index <note_id>
ai-knowledge note list
ai-knowledge note show <note_id>

ai-knowledge answer "<question>"
```

说明：

- `source list/show` 与 `note list/show` 是 P0 只读辅助命令，用于查看工作流状态。
- `note render` 用于从 `note.json` 重新渲染 `note.md`，方便 QA 修复后重新成稿。
- 所有非交互命令应支持 `--json`。
- P0 不提供 `collect` 或 `candidate` 命令；自动采集留到 P2 再讨论。

### 8.2 Markdown Ingest

命令：

```bash
ai-knowledge source ingest markdown <file>
```

输出：

```text
knowledge/sources/YYYY/MM/src_xxx/
  source.json
  discussion.jsonl
  raw/original.md
  processed/
```

规则：

- 用户主动导入直接创建 `Source`。
- 初始状态为 `ingested`。
- 原始 Markdown 必须复制到 `raw/`。
- P0 不经过 Candidate。

成功后 CLI 应展示下一步命令：

```bash
ai-knowledge source process <source_id>
```

### 8.3 Markdown Processing

命令：

```bash
ai-knowledge source process <source_id>
```

输出：

```text
processed/
  clean_text.md
  segments.json
  metadata.json
```

`source.json.processing_artifacts` 必须登记这些相对路径。

处理完成后，Source 状态流转：

```text
ingested -> processing -> processed
```

成功后 CLI 应展示下一步命令：

```bash
ai-knowledge source understand <source_id>
```

### 8.4 Draft Understanding

命令：

```bash
ai-knowledge source understand <source_id>
```

输入：

- `processed/clean_text.md`
- `processed/segments.json`
- `processed/metadata.json`
- 可选的相关 approved Note 摘要

输出写入 `source.json.draft_understanding`。

状态流转：

```text
processed -> understanding_ready
```

可选参数：

```bash
ai-knowledge source understand <source_id> --show
```

`--show` 用于在生成后展示完整 `draft_understanding`。

成功后 CLI 应展示下一步命令：

```bash
ai-knowledge source discuss <source_id>
```

### 8.5 Discussion

命令：

```bash
ai-knowledge source discuss <source_id>
```

`discuss` 是交互式 REPL。

交互规则：

- 首次进入时展示 Source 基本信息和 `draft_understanding` 摘要。
- 每轮用户消息追加到 `discussion.jsonl`。
- 每轮 Agent 回复也追加到 `discussion.jsonl`。
- 每轮后更新 `source.json.discussion_summary`。
- 讨论必须围绕理解、判断、价值、不确定性展开。
- 系统必须维护 `summary_version`。

内置命令：

```text
/summary   显示当前 discussion_summary
/draft     显示 draft_understanding
/status    显示 Source 状态和收敛情况
/approve   尝试确认当前结论
/exit      退出讨论，不改变状态
/help      显示可用命令
```

`/approve` 不允许强制确认。只有当 `discussion_summary.ready_for_approval = true` 且 `confirmed_points` 非空时，才可触发 Source approve workflow。

### 8.6 Source Approval

命令：

```bash
ai-knowledge source approve <source_id>
```

确认条件：

- 用户明确执行 approve。
- `discussion_summary.ready_for_approval = true`。
- `discussion_summary.confirmed_points` 非空。

状态流转：

```text
discussing -> approved_for_note
```

没有明确确认，不得生成正式 Note。

成功后 CLI 应展示下一步命令：

```bash
ai-knowledge note compose <source_id>
```

### 8.7 Source List / Show

命令：

```bash
ai-knowledge source list
ai-knowledge source list --status understanding_ready
ai-knowledge source show <source_id>
```

`source list` 用于查看 Source 队列，至少展示：

- id
- status
- title
- updated_at

`source show` 用于查看单个 Source 的当前工作状态，至少展示：

- title
- status
- ingest_type
- content_type
- processing_artifacts
- draft_understanding summary
- discussion_summary status
- note_ids

### 8.8 Compose Note

命令：

```bash
ai-knowledge note compose <source_id>
```

前置条件：

```text
Source.status = approved_for_note
```

输出：

```text
knowledge/notes/YYYY/MM/note_xxx/
  note.json
  note.md
```

顺序：

1. 生成 `note.json`。
2. 根据 `note.json` 渲染 `note.md`。

初始状态：

```text
Note.status = draft
```

成功后 CLI 应展示下一步命令：

```bash
ai-knowledge note lint <note_id>
```

### 8.9 Render Note

命令：

```bash
ai-knowledge note render <note_id>
```

用途：

- 从 `note.json` 重新渲染 `note.md`。
- 用于修改结构化 Note 后重新生成 Markdown。

规则：

- `note.json` 仍是主真相。
- `note.md` 不得反向覆盖 `note.json`。

### 8.10 Note QA 与批准

命令：

```bash
ai-knowledge note lint <note_id>
ai-knowledge note approve <note_id>
```

规则：

- `note lint` 只做规则检查并写入 `quality_checks`。
- 只有 `quality_checks.status = passed`，才能执行 `note approve`。
- `note approve` 将 Note 状态改为 `approved`。

成功后 CLI 应展示下一步命令：

```bash
ai-knowledge note index <note_id>
```

### 8.11 Index Entry

命令：

```bash
ai-knowledge note index <note_id>
```

前置条件：

```text
Note.status = approved
```

P0 只对 `approved` Note 建立关键词 / metadata 索引。

`vector_ref` 在 P0 中保留为 `null`。

### 8.12 Note List / Show

命令：

```bash
ai-knowledge note list
ai-knowledge note list --status approved
ai-knowledge note show <note_id>
```

`note list` 至少展示：

- id
- status
- title
- updated_at

`note show` 至少展示：

- title
- status
- conclusions
- source_refs
- related_note_ids
- quality_checks

### 8.13 Answer

命令：

```bash
ai-knowledge answer "<question>"
```

可选参数：

```bash
ai-knowledge answer "<question>" --json
ai-knowledge answer "<question>" --top-k 5
```

P0 检索顺序：

1. `knowledge/index/` 中的 approved Index Entry。
2. 对应的 approved `note.json`。
3. 必要时补充对应 Source 的 `discussion_summary`，并标注未确认属性。

回答必须区分：

- 已确认知识。
- 未确认讨论材料。
- 当前知识库无法回答的部分。

默认回答结构：

```md
## 综合结论

## 依据的已确认笔记

## 补充但未确认的材料

## 不足与边界
```

## 9. P1-P4 阶段规划

### 9.1 P1：PDF 支持

增加 PDF 导入与处理：

- 原始 PDF 保存到 `raw/`。
- 文本提取。
- metadata 提取。
- 页码或章节级 segment。
- `processing_artifacts` 登记。

### 9.2 P2：自动采集候选池

增加：

- GitHub Trending collector。
- Hacker News collector。
- Candidate 去重。
- Candidate 规则评分。
- Candidate 推荐列表。
- Candidate 转 Source。

自动采集内容必须先进入候选池，由用户选择后才进入正式学习流程。

### 9.3 P3：向量检索

在关键词 / metadata 检索基础上增加向量检索。

实现时应保持：

- `Index Entry` 只是检索入口。
- `note.json` 仍是知识主真相。
- `vector_ref` 只引用向量索引位置。

### 9.4 P4：相关笔记关系增强

增强 `related_note_ids`：

- 规则生成候选关系。
- LLM 建议相关笔记。
- 用户确认后写入 `note.json`。
- 支持主题、时间、概念三类关系。

## 10. CLI 命令规范

P0 CLI 采用资源化命令结构：

```bash
ai-knowledge source ingest markdown <file>
ai-knowledge source process <source_id>
ai-knowledge source understand <source_id>
ai-knowledge source discuss <source_id>
ai-knowledge source approve <source_id>
ai-knowledge source list
ai-knowledge source show <source_id>

ai-knowledge note compose <source_id>
ai-knowledge note render <note_id>
ai-knowledge note lint <note_id>
ai-knowledge note approve <note_id>
ai-knowledge note index <note_id>
ai-knowledge note list
ai-knowledge note show <note_id>

ai-knowledge answer "<question>"
```

CLI 命令应保持对象边界清晰、状态显式，不隐藏关键门槛。

已确认的 CLI 决策：

1. 使用 `source ...` / `note ...` / `answer ...` 的资源化结构。
2. P0 加入只读辅助命令：`source list/show`、`note list/show`。
3. P0 加入 `note render`，用于从 `note.json` 重新渲染 `note.md`。
4. `source discuss` 使用交互式 REPL。
5. `discuss` 内的 `/approve` 不允许强制确认，必须满足 `ready_for_approval = true`。
6. 所有非交互命令统一支持 `--json`。
7. CLI 展示 workflow 返回的 `next_actions`，不自行推导下一步业务动作。

自动采集相关 CLI 不纳入 P0；GitHub Trending / Hacker News 的 `collect` 与 `candidate` 命令留到 P2 再单独讨论。

## 11. LLM 调用规范

### 11.1 LLM 不直接决定状态

LLM 可以生成：

- `draft_understanding`
- `discussion_summary_update`
- `note_json_candidate`
- grounded answer draft

但不能直接修改：

- Source status
- Note status
- Candidate status
- Index Entry

### 11.2 LLM 输出必须结构化

LLM 输出必须通过 Zod 校验。

校验失败时：

- workflow 失败。
- 不进入下一状态。
- 必要时写入 `Source.last_error`。

不要静默修复不可信输出。

### 11.3 Prompt 文件化

Prompt 必须独立保存到：

```text
src/agents/prompts/
```

Prompt 属于产品逻辑，应进入版本管理。

## 12. 测试规范

### 12.1 单元测试重点

- ID 生成。
- slug 生成。
- 状态机。
- validators。
- path generation。
- markdown renderer。
- note lint。

### 12.2 集成测试重点

使用 fixtures 跑通 P0 链路：

```text
ingest markdown -> process -> understand mock -> discuss mock
-> approve -> compose note -> lint -> approve note -> index
```

### 12.3 LLM 测试策略

测试不依赖真实 LLM。

约定：

- Agent 接口可注入 mock。
- Workflow 测试使用 fake agent。
- Prompt 本身先不做复杂自动测试。

## 13. 代码风格规范

建议使用：

```text
Formatter: Prettier
Lint: ESLint
Type checking: tsc --noEmit
Test: Vitest
```

命名规范：

- 文件名：`kebab-case`
- 类型名：`PascalCase`
- 函数名：`snake_case` 或 `camelCase` 二选一；为贴近 JSON 契约，项目内建议统一 `snake_case`
- JSON 字段：`snake_case`
- TS 核心对象字段：`snake_case`

如果后续决定函数名采用 `camelCase`，需要统一更新本节；不要混用。

## 14. 不可跳过的实现约束

实现层必须强制以下约束：

1. 没有预处理结果，不得生成 `draft_understanding`。
2. 没有讨论收敛与明确确认，不得生成正式 `Note`。
3. 没有通过 QA / lint，`Note` 不得进入 `approved`。
4. 没有 `approved` 状态，`Note` 不得进入主索引层。
5. 自动采集内容不得跳过 `Candidate` 直接成为 `Source`。
6. `note.md` 不得反向成为正式知识主编辑面。
7. 问答默认优先使用 approved Note，而不是原始 Source。
8. LLM 输出未通过结构化校验时，不得进入下一状态。
9. P0 不引入 PDF、自动采集或向量检索。

## 15. 后续需要继续讨论的问题

后续建议逐项讨论：

1. P0 CLI 的具体交互形态。
2. Markdown processing 的 segment 规则。
3. `draft_understanding` prompt 与质量标准。
4. `discussion_summary` 的增量更新策略。
5. 讨论收敛条件采用纯规则、LLM 判断还是混合判断。
6. `approve` 是否允许人工覆盖 `ready_for_approval`。
7. `note.json` 是否需要补充核心概念字段。
8. Markdown 模板是否固定。
9. QA / lint 的失败恢复策略。
10. `related_note_ids` 的生成和确认机制。
11. P1 PDF 的解析边界。
12. P2 自动采集评分规则与推荐阈值。
13. P3 向量索引的存储方案。
14. Source / Note 版本策略的交互细节。

## 16. 总结

MVP 的实现重点不是做一个资料总结器，而是实现一条严格的知识流转路径：

```text
资料进入 -> 处理 -> 初步理解 -> 多轮讨论 -> 用户确认
-> Note JSON -> Markdown -> QA -> 索引 -> 问答
```

当前已确认的实现基线是：

```text
TypeScript + Node.js LTS
CLI first
本地文件系统存储
Zod 运行时校验
snake_case 对象字段
P0 仅 Markdown 主动导入
P0 仅关键词 / metadata 检索
note.json 作为正式知识主真相
```

后续所有功能设计都应服务于这条闭环，而不是绕过它。
