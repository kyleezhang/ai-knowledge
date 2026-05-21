# AI 学习助手 Issue Breakdown

## 1. 文档目标

本文档基于 `specs/implementation.md`，记录 P0 Markdown 主动学习闭环的 issue 拆分，并补充当前已确认的 P1 设计草案。

P0 范围：

```text
Markdown -> Source -> Processed Artifacts -> Draft Understanding
-> Discussion Summary -> Approval -> Note JSON -> Note Markdown
-> QA -> Approved Note -> Index Entry -> Answer
```

P0 不包含：

- PDF 支持
- 用户显式提供的 URL 导入
- GitHub Trending / Hacker News 自动采集
- Candidate 工作流
- 向量检索
- Web UI

当前确认的 P1 范围：

```text
PDF file / Public URL -> Source -> Processed Artifacts -> Draft Understanding
-> Discussion Summary -> Approval -> Note JSON -> Note Markdown
-> QA -> Approved Note -> Index Entry -> Answer
```

P1 聚焦“扩展 Source 输入类型，但不改变下游知识主链路”。P1 只支持：

- 用户主动导入本地 PDF
- 用户显式提交公开网页 / 博客 URL

P1 不包含：

- 自动爬站 / 批量抓取 / 搜索发现
- 登录态、付费墙或需要 session 的网页
- JS 渲染兜底与浏览器自动化抓取
- Candidate 工作流
- 向量检索
- Web UI

## 2. Issue 列表

### Issue 1: 初始化 TypeScript CLI 项目与知识库目录

- **Type**: AFK
- **Blocked by**: None
- **User stories covered**:
  - 用户可以初始化本地 AI 学习助手工作区
  - 开发者可以运行 CLI、测试、lint/typecheck

#### What to build

建立 TypeScript + Node.js + pnpm + ESM 项目骨架，实现 `ai-knowledge init`，创建 P0 所需 `knowledge/` 目录结构。

#### Acceptance criteria

- [ ] 项目包含 TypeScript、pnpm、ESM、Vitest、ESLint、Prettier 基础配置
- [ ] CLI 可执行 `ai-knowledge init`
- [ ] `init` 创建 `knowledge/candidates/`、`knowledge/sources/`、`knowledge/notes/`、`knowledge/index/`
- [ ] `init` 幂等，不覆盖已有文件
- [ ] 有基础 CLI 测试或 smoke test

#### Blocked by

None - can start immediately

---

### Issue 2: 导入 Markdown 为 Source，并支持 Source 查看

- **Type**: AFK
- **Blocked by**: Issue 1
- **User stories covered**:
  - 用户可以主动导入 Markdown 学习资料
  - 系统把用户资料转成 Source 工作对象
  - 用户可以查看已导入资料和当前 Source 状态

#### What to build

实现 `ai-knowledge source ingest markdown <file>`，创建 `Source` 目录、`source.json`、空 `discussion.jsonl`，保存 `raw/original.md`；同时实现 `source list/show` 作为 Source 工作流的只读入口。

#### Acceptance criteria

- [ ] `source ingest markdown <file>` 可导入本地 Markdown 文件
- [ ] 生成合法 `Source` 对象，状态为 `ingested`
- [ ] `processing_artifacts = {}`
- [ ] `draft_understanding = null`
- [ ] `discussion_summary.summary_version = 0`
- [ ] 原始文件保存为 `raw/original.md`
- [ ] 成功输出 next action：`ai-knowledge source process <source_id>`
- [ ] `source list` 展示 id、status、title、updated_at
- [ ] `source list --status <status>` 可过滤
- [ ] `source show <source_id>` 展示 Source 关键状态，不默认输出完整正文 artifact
- [ ] list 默认按 `updated_at desc`
- [ ] 支持 `--json`
- [ ] 覆盖 domain schema、storage、workflow、CLI 测试

#### Blocked by

- Issue 1

---

### Issue 3: 处理 Markdown 生成 processed artifacts

- **Type**: AFK
- **Blocked by**: Issue 2
- **User stories covered**:
  - 系统可以把导入资料转换成统一可理解表示
  - 后续 Agent 可以基于处理产物生成理解草稿

#### What to build

实现 `ai-knowledge source process <source_id>`，读取 `raw/original.md`，生成 processed 三件套，并把 Source 状态推进到 `processed`。

#### Acceptance criteria

- [ ] 前置状态必须为 `ingested`
- [ ] 状态流转：`ingested -> processing -> processed`
- [ ] 生成 `processed/clean_text.md`
- [ ] 生成 `processed/segments.json`
- [ ] 生成 `processed/metadata.json`
- [ ] `source.json.processing_artifacts` 登记相对路径
- [ ] processing 失败时 Source 进入 `failed` 并写 `last_error.stage = processing`
- [ ] 成功输出 next action：`ai-knowledge source understand <source_id>`
- [ ] 支持 `--json`

#### Blocked by

- Issue 2

---

### Issue 4: 接入 LLM Client 与 Prompt 加载

- **Type**: AFK
- **Blocked by**: Issue 1
- **User stories covered**:
  - 系统可以通过统一 Agent 接口调用模型
  - Agent 输出必须结构化并可校验

#### What to build

实现 Agent 层基础设施：Anthropic SDK client、DeepSeek Anthropic-compatible 配置、prompt loader、`generate_json`、AgentError。

#### Acceptance criteria

- [ ] 使用 `@anthropic-ai/sdk`
- [ ] `baseURL = https://api.deepseek.com/anthropic`
- [ ] API key 从 `process.env.GATEWAY_API_KEY` 获取
- [ ] 默认模型为 `deepseek-v4-pro`
- [ ] 实现 `generate_json`，接收 Zod schema 并校验输出
- [ ] LLM 输出 schema 校验失败抛 `AgentError: LLM_OUTPUT_SCHEMA_FAILED`
- [ ] Prompt 从 `src/agents/prompts/` 加载
- [ ] 单元测试不依赖真实 LLM，可 mock client

#### Blocked by

- Issue 1

---

### Issue 5: 生成 draft_understanding

- **Type**: AFK
- **Blocked by**: Issue 3, Issue 4
- **User stories covered**:
  - 系统在讨论前先形成初步理解草稿
  - 草稿显式暴露不确定性和讨论切口

#### What to build

实现 `ai-knowledge source understand <source_id>`，基于 processed artifacts 调用 Understand Agent，写入 `draft_understanding`，状态推进到 `understanding_ready`。

#### Acceptance criteria

- [ ] 前置状态必须为 `processed`
- [ ] 调用 `understand-agent`
- [ ] 使用 `draft-understanding.md`
- [ ] 输出包含 `summary`、`key_points`、`uncertainties`、`discussion_starters`
- [ ] workflow 补 `generated_at`
- [ ] 状态流转：`processed -> understanding_ready`
- [ ] LLM 或 schema 失败时 Source 进入 `failed`，写 `last_error.stage = understanding`
- [ ] 成功输出 next action：`ai-knowledge source discuss <source_id>`
- [ ] 支持 `--show`
- [ ] 支持 `--json`

#### Blocked by

- Issue 3
- Issue 4

---

### Issue 6: 交互式 Source 讨论 REPL

- **Type**: HITL
- **Blocked by**: Issue 5
- **User stories covered**:
  - 用户可以围绕单个 Source 与 Agent 多轮讨论
  - 系统维护原始讨论消息和结构化讨论摘要

#### What to build

实现 `ai-knowledge source discuss <source_id>` 交互式 REPL。每轮调用 Discussion Agent，追加 `discussion.jsonl`，更新 `discussion_summary`。

#### Acceptance criteria

- [ ] 前置状态支持 `understanding_ready | discussing`
- [ ] 首次讨论自动流转到 `discussing`
- [ ] 用户消息 append 到 `discussion.jsonl`
- [ ] Agent 回复 append 到 `discussion.jsonl`
- [ ] 每轮更新 `discussion_summary`
- [ ] 支持内置命令：`/summary`、`/draft`、`/status`、`/approve`、`/exit`、`/help`
- [ ] `/approve` 不允许强制确认，必须满足 ready 条件
- [ ] discussion agent 单轮失败时保持 `discussing`，写 `last_error.stage = discussion`
- [ ] 人工验收 REPL 交互体验

#### Blocked by

- Issue 5

---

### Issue 7: Source 讨论确认

- **Type**: AFK
- **Blocked by**: Issue 6
- **User stories covered**:
  - 用户明确确认结构化结论可以落笔
  - 系统防止未收敛讨论直接生成正式 Note

#### What to build

实现 `ai-knowledge source approve <source_id>`，校验讨论收敛条件后将 Source 推进到 `approved_for_note`。

#### Acceptance criteria

- [ ] 前置状态必须为 `discussing`
- [ ] `discussion_summary.ready_for_approval = true`
- [ ] `confirmed_points` 非空
- [ ] 状态流转：`discussing -> approved_for_note`
- [ ] `discussion_summary.discussion_status = closed`
- [ ] 不支持强制 approve
- [ ] 成功输出 next action：`ai-knowledge note compose <source_id>`
- [ ] 支持 `--json`

#### Blocked by

- Issue 6

---

### Issue 8: 生成 Note JSON / Markdown，并支持 Note 查看与重渲染

- **Type**: AFK
- **Blocked by**: Issue 7
- **User stories covered**:
  - 用户确认后的讨论结果可以沉淀为正式 Note 草稿
  - `note.json` 是主真相，`note.md` 是导出视图
  - 用户可以查看已生成笔记并从 `note.json` 重新渲染 Markdown

#### What to build

实现 `ai-knowledge note compose <source_id>`，调用 Note Agent 生成 Note 候选，workflow 补系统字段，渲染 Markdown，创建 Note 目录，并关联回 Source。同时实现 `note render`、`note list`、`note show`。

#### Acceptance criteria

- [ ] 前置状态必须为 `Source.status = approved_for_note`
- [ ] Note Agent 使用 `compose-note-json.md`
- [ ] `conclusions` 只能来自 `confirmed_points`
- [ ] workflow 补 id、slug、status、version、timestamps、approval_context、quality_checks
- [ ] 生成 `note.json`
- [ ] 生成 `note.md`
- [ ] 初始 `Note.status = draft`
- [ ] 更新 `Source.note_ids`
- [ ] Source 状态流转：`approved_for_note -> noted`
- [ ] Source 更新失败时返回 `PARTIAL_FAILURE`
- [ ] 成功输出 next action：`ai-knowledge note lint <note_id>`
- [ ] `note render <note_id>` 从 `note.json` 重新渲染 `note.md`，不改变 Note 状态
- [ ] `note list` 展示 id、status、title、updated_at，默认按 `updated_at desc`
- [ ] `note list --status <status>` 可过滤
- [ ] `note show <note_id>` 展示 title、status、conclusions、source_refs、related_note_ids、quality_checks
- [ ] `note show` 不默认输出完整 `note.md`
- [ ] 支持 `--json`

#### Blocked by

- Issue 7

---

### Issue 9: Note QA / lint

- **Type**: AFK
- **Blocked by**: Issue 8
- **User stories covered**:
  - 系统在入库前检查 Note 质量
  - 未通过 QA 的 Note 不能进入 approved 状态

#### What to build

实现 `ai-knowledge note lint <note_id>`，检查 `note.json` 与 `note.md` 的最小质量规则，写入 `quality_checks`。

#### Acceptance criteria

- [ ] P0 只允许 lint `draft` Note
- [ ] 检查 required fields
- [ ] 检查 Markdown 模板章节完整
- [ ] 检查 `source_refs` 非空
- [ ] 检查 `conclusions` 非空
- [ ] 检查 `why_it_matters` 非空
- [ ] 检查 `approval_context.source_id`
- [ ] 检查 `approval_context.approved_from_summary_version`
- [ ] 成功时写 `quality_checks.status = passed`
- [ ] 失败时写 `quality_checks.status = failed` 并返回失败原因
- [ ] 通过后输出 next action：`ai-knowledge note approve <note_id>`
- [ ] 支持 `--json`

#### Blocked by

- Issue 8

---

### Issue 10: Note 批准与索引

- **Type**: AFK
- **Blocked by**: Issue 9
- **User stories covered**:
  - 通过 QA 的 Note 可以进入主知识层
  - approved Note 可以成为后续问答检索来源

#### What to build

实现 `ai-knowledge note approve <note_id>` 与 `ai-knowledge note index <note_id>`，将 draft Note 批准并建立关键词 / metadata 索引。

#### Acceptance criteria

- [ ] `note approve` 前置条件：`Note.status = draft`
- [ ] `note approve` 前置条件：`quality_checks.status = passed`
- [ ] 状态流转：`draft -> approved`
- [ ] 设置 `approved_at`
- [ ] 成功输出 next action：`ai-knowledge note index <note_id>`
- [ ] `note index` 只接受 `approved` Note
- [ ] 生成 `knowledge/index/YYYY/MM/note_xxx.index.json`
- [ ] `vector_ref = null`
- [ ] Index Entry status 只能为 `approved`
- [ ] 支持 `--json`

#### Blocked by

- Issue 9

---

### Issue 11: 基于 approved Notes 回答问题

- **Type**: AFK
- **Blocked by**: Issue 10
- **User stories covered**:
  - 用户可以基于已确认知识进行后续问答
  - 系统不会把未确认 Source 当作正式知识

#### What to build

实现 `ai-knowledge answer "<question>"`，只检索 approved Note 的 Index Entry，加载 Note 后调用 Answer Agent 生成 grounded answer。

#### Acceptance criteria

- [ ] 只检索 approved Index Entry
- [ ] P0 不 fallback 到 Source
- [ ] Answer Agent 使用 `answer-grounded.md`
- [ ] 不使用模型常识补充为知识库结论
- [ ] 没有命中时明确说明没有相关已确认知识
- [ ] 输出结构包含综合结论、引用 Notes、不足与边界
- [ ] 支持 `--top-k`
- [ ] 支持 `--json`

#### Blocked by

- Issue 10

---

### Issue 12: P0 端到端验收用例

- **Type**: HITL
- **Blocked by**: Issue 1-11
- **User stories covered**:
  - 用户可以完成完整 Markdown 学习闭环
  - 产品核心假设可以被端到端验证

#### What to build

准备一个 P0 端到端验收 fixture 和验收脚本/文档，跑通完整链路：

```text
Markdown -> Source -> Processed Artifacts -> Draft Understanding
-> Discussion Summary -> Approval -> Note JSON -> Note Markdown
-> QA -> Approved Note -> Index Entry -> Answer
```

#### Acceptance criteria

- [ ] 有一份 Markdown fixture
- [ ] 有端到端验收步骤
- [ ] 可以从空 `knowledge/` 跑到 approved Note
- [ ] 可以基于 approved Note 回答问题
- [ ] 验收中确认：没有讨论确认不能生成 Note
- [ ] 验收中确认：没有 QA passed 不能 approve Note
- [ ] 人工确认 CLI 交互体验可接受

#### Blocked by

- Issue 1
- Issue 2
- Issue 3
- Issue 4
- Issue 5
- Issue 6
- Issue 7
- Issue 8
- Issue 9
- Issue 10
- Issue 11

---

### Issue 13: 扩展 Source 输入契约到 P1（PDF / URL）

- **Type**: AFK
- **Blocked by**: Issue 2
- **User stories covered**:
  - 用户可以把本地 PDF 作为学习资料导入
  - 用户可以显式提交公开博客 / 网页 URL 作为学习资料导入
  - 系统对不同输入类型统一落入 Source 工作流，而不改变后续主链路

#### What to build

扩展 `Source` schema、ingest CLI 与原始落盘约定，为 P1 新增 `ai-knowledge source ingest pdf <file>` 与 `ai-knowledge source ingest url <url>`。PDF ingest 保存 `raw/original.pdf`；URL ingest 在显式抓取成功后保存 `raw/original.url` 与 `raw/fetched.html`，并登记来源元信息。该 issue 只定义输入契约与存储约定，不改变下游 `process -> understand -> discuss -> approve -> note -> index -> answer` 语义。

#### Acceptance criteria

- [ ] `origin.user_input_type` 支持 `markdown | pdf | url`
- [ ] `ingest_type` 支持 `upload_markdown | upload_pdf | submit_url`
- [ ] `content_type` 支持 `document | webpage`
- [ ] `source ingest pdf <file>` 成功时创建 `ingested` Source 并保存 `raw/original.pdf`
- [ ] `source ingest url <url>` 只接受显式提供的 `http | https` URL
- [ ] URL ingest 成功时保存 `raw/original.url`
- [ ] URL ingest 成功时保存 `raw/fetched.html`
- [ ] URL ingest 在 `source.json` 记录原始 URL、最终 URL（如有 redirect）与抓取时间
- [ ] `source list/show` 能正确展示 PDF / URL Source 的基本信息
- [ ] 支持 `--json`
- [ ] 不支持自动爬站、批量 URL 导入、搜索发现或登录态抓取

#### Blocked by

- Issue 2

---

### Issue 14: 处理 PDF Source 生成 processed artifacts

- **Type**: AFK
- **Blocked by**: Issue 3, Issue 13
- **User stories covered**:
  - 用户可以把 PDF 学习资料转成统一可理解文本证据
  - 后续理解、讨论、Note 与问答链路可以复用既有 P0 能力

#### What to build

扩展 `ai-knowledge source process <source_id>` 以支持 PDF Source：读取 `raw/original.pdf`，提取文本并生成 processed 三件套。PDF 的 processed 输出仍与 Markdown 对齐，但在 `segments` 和 `metadata` 中补充页码与抽取信息，供后续 evidence locator 使用。

#### Acceptance criteria

- [ ] 前置状态必须为 `ingested`
- [ ] `source process` 可识别 PDF Source 并读取 `raw/original.pdf`
- [ ] 生成 `processed/clean_text.md`
- [ ] 生成 `processed/segments.json`
- [ ] 生成 `processed/metadata.json`
- [ ] PDF `segments` 提供页码或等价 locator，供后续 `source_refs.evidence_refs` 使用
- [ ] PDF `metadata` 记录页数、抽取方式与抽取失败信息
- [ ] 处理成功后仍输出 next action：`ai-knowledge source understand <source_id>`
- [ ] processing 失败时 Source 进入 `failed` 并写 `last_error.stage = processing`
- [ ] `understand`、`discuss`、`approve`、`note compose` 无需增加 PDF 专用命令
- [ ] 支持 `--json`
- [ ] P1 不要求 OCR 扫描件支持

#### Blocked by

- Issue 3
- Issue 13

---

### Issue 15: 抓取 URL Source 并处理网页正文

- **Type**: AFK
- **Blocked by**: Issue 3, Issue 13
- **User stories covered**:
  - 用户可以把博客 / 网页链接作为学习资料导入
  - 系统先读取网页内容，再进入现有知识处理流程
  - 系统显式区分公开网页输入与后续自动采集能力

#### What to build

实现 `ai-knowledge source ingest url <url>` 的公开网页抓取，并扩展 `source process <source_id>` 以支持 HTML 正文提取。ingest 阶段负责抓取并保存快照；process 阶段负责正文抽取、标题 / 作者 / 发布时间归一化与 section 分段。

#### Acceptance criteria

- [ ] `source ingest url <url>` 只支持 `http | https`
- [ ] ingest 阶段完成网页读取，并保存 `raw/fetched.html`
- [ ] ingest 阶段保存 `raw/original.url`
- [ ] fetch 成功后 Source 状态为 `ingested`
- [ ] fetch 失败时返回结构化错误，不生成成功的 `ingested` Source
- [ ] `source process` 可从 `raw/fetched.html` 提取 `processed/clean_text.md`
- [ ] `source process` 生成 `processed/segments.json` 与 `processed/metadata.json`
- [ ] `metadata` 尽可能归一化 `title`、`author`、`published_at`，缺失时允许 `null`
- [ ] 支持 redirect 后最终 URL 记录
- [ ] 支持不支持的 `content-type` / 抓取失败的明确错误反馈
- [ ] 支持 `--json`
- [ ] 不支持登录态、付费墙、站点级抓取、搜索发现或 JS 渲染兜底

#### Blocked by

- Issue 3
- Issue 13

---

### Issue 16: 统一跨来源 evidence locator

- **Type**: AFK
- **Blocked by**: Issue 8, Issue 14, Issue 15
- **User stories covered**:
  - Note 可以稳定引用 Markdown / PDF / URL 的证据片段
  - 不同输入类型不会破坏 approved knowledge 的可追溯性

#### What to build

统一 processed segment 与 `source_refs.evidence_refs` 的定位约定，使 Markdown、PDF、URL 都通过 processed artifacts 暴露稳定证据引用，而不是直接引用 raw 文件。必要时扩展 segment locator 字段，但保持 `Note` 主真相与 `source_refs` 语义一致。

#### Acceptance criteria

- [ ] Markdown / PDF / URL 都产出统一的 `processed/segments.json` 基础结构
- [ ] Markdown 现有 evidence refs 保持有效
- [ ] PDF segment locator 能定位到页码或等价页内位置
- [ ] URL segment locator 能定位到 heading_path、section 或等价正文位置
- [ ] `Note.source_refs.evidence_refs` 继续只引用 processed artifacts，不直接引用 raw html / raw pdf
- [ ] `note render`、`note show` 与后续 QA 规则在多来源输入下仍成立
- [ ] `answer` 语义不变，仍然只基于 approved Notes 作答

#### Blocked by

- Issue 8
- Issue 14
- Issue 15

---

### Issue 17: P1 端到端验收用例（PDF / URL）

- **Type**: HITL
- **Blocked by**: Issue 13-16
- **User stories covered**:
  - 用户可以完成 PDF 与公开 URL 的完整学习闭环
  - 产品可以验证 P1 输入扩展不会破坏既有 P0 知识主链路

#### What to build

准备 P1 端到端验收 fixture 与验收脚本 / 文档，分别跑通 PDF happy path 与 URL happy path：

```text
PDF / Public URL -> Source -> Processed Artifacts -> Draft Understanding
-> Discussion Summary -> Approval -> Note JSON -> Note Markdown
-> QA -> Approved Note -> Index Entry -> Answer
```

#### Acceptance criteria

- [ ] 有一份可稳定抽取文本的 PDF fixture
- [ ] 有一个可稳定抓取的 URL fixture（本地 test server 或 mocked public page）
- [ ] PDF happy path 可以从空 `knowledge/` 跑到 approved Note 与 answer
- [ ] URL happy path 可以从空 `knowledge/` 跑到 approved Note 与 answer
- [ ] 验收中确认：URL fetch 失败会明确报错
- [ ] 验收中确认：不支持的网页 content-type 会明确报错
- [ ] 验收中确认：PDF 抽取失败会明确报错
- [ ] 验收中确认：没有讨论确认不能生成 Note
- [ ] 验收中确认：没有 QA passed 不能 approve Note
- [ ] 人工确认 CLI 交互体验与来源追溯信息可接受

#### Blocked by

- Issue 13
- Issue 14
- Issue 15
- Issue 16

## 3. Dependency Map

### P0

```text
1
├─ 2
│  └─ 3
│     └─ 5
│        └─ 6
│           └─ 7
│              └─ 8
│                 └─ 9
│                    └─ 10
│                       └─ 11
├─ 4
│  ├─ 5
│  ├─ 6
│  ├─ 8
│  └─ 11
└─ 12 depends on 1-11
```

### P1

```text
13 depends on 2
14 depends on 3, 13
15 depends on 3, 13
16 depends on 8, 14, 15
17 depends on 13, 14, 15, 16
```

## 4. Notes

- 当前 issue 拆分覆盖已完成的 P0 与当前确认的 P1 输入扩展范围。
- P1 聚焦 PDF 主动导入与用户显式提供的公开 URL 导入，不改变下游知识主链路。
- URL 导入不包含自动爬站、批量抓取、搜索发现、登录态页面或 JS 渲染兜底。
- P2 自动采集相关命令和 Candidate workflow 暂不拆分。
- 向量检索暂不拆分，仍放在后续阶段。
- HITL issue 目前包括交互式讨论 REPL、P0 端到端验收与 P1 端到端验收。
