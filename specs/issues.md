# AI 学习助手 Issue Breakdown

## 1. 文档目标

本文档基于 `specs/prd.md`、`specs/workflow.md`、`specs/schema.md` 与 `specs/implementation.md`，记录从 P0/P1 到最终预期能力的 issue 拆分。

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
- Candidate 工作流接入
- 向量检索
- Web UI

P1 范围：

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
- Candidate 工作流接入
- 向量检索
- Web UI

P2+ 范围用于覆盖最终预期能力，包括：

- Candidate 候选池与自动采集
- 飞书文档等主动输入扩展
- 更严格的讨论收敛判定
- Note 归档、版本化与相关关系治理
- 向量索引与混合检索
- 问答 fallback 到未确认材料并显式标注
- 异步任务、重试与定时采集

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
- [ ] `ingest_type` 支持 `upload_markdown | upload_pdf | input_url`
- [ ] `content_type` 支持 `document | link`
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

---

### Issue 18: 实现 Candidate domain schema/type

- **Type**: AFK
- **Blocked by**: Issue 1
- **User stories covered**:
  - 系统可以把自动采集内容表示为轻量候选对象
  - Candidate 与 Source 在对象层保持清晰边界

#### What to build

实现 `Candidate` 的 domain schema、type、状态枚举与 invariant 校验，但暂不接入自动采集 workflow。该 issue 补齐 `specs/schema.md` 与 `specs/implementation.md` 对 Candidate 基础契约的要求。

#### Acceptance criteria

- [ ] 新增 `src/domain/candidate.ts`
- [ ] 支持 `source_type = github_trending | hacker_news`
- [ ] 支持状态：`new | recommended | dismissed | selected | converted`
- [ ] 支持 score breakdown：`relevance`、`learning_value`、`novelty`、`discussability`
- [ ] 校验每个 score 子项范围为 0-3
- [ ] 校验 `score.total` 等于 breakdown 汇总
- [ ] 校验 `status = converted` 时 `converted_source_id` 非空
- [ ] 导出 `CandidateSchema`、`CandidateStatusSchema`、`parse_candidate`
- [ ] 覆盖 domain 单元测试

#### Blocked by

- Issue 1

---

### Issue 19: Candidate 存储与只读查看

- **Type**: AFK
- **Blocked by**: Issue 18
- **User stories covered**:
  - 用户可以查看自动采集候选池
  - 系统可以持久化 Candidate 并保留推荐状态

#### What to build

实现 Candidate 的文件系统存储、列表与查看能力。Candidate 仍不进入主知识层，不允许被 answer 直接检索。

#### Acceptance criteria

- [ ] 新增 `candidate-repo` 或等价 storage 模块
- [ ] Candidate 保存到 `knowledge/candidates/YYYY/MM/cand_xxx.json`
- [ ] 支持 `candidate list`
- [ ] 支持 `candidate list --status <status>`
- [ ] 支持 `candidate show <candidate_id>`
- [ ] list 默认按 `collected_at desc`
- [ ] 读写 JSON 时通过 `CandidateSchema` parse
- [ ] 不把 Candidate 写入 `knowledge/index/`
- [ ] 支持 `--json`
- [ ] 覆盖 storage、workflow、CLI 测试

#### Blocked by

- Issue 18

---

### Issue 20: GitHub Trending / Hacker News 采集器

- **Type**: AFK
- **Blocked by**: Issue 19
- **User stories covered**:
  - 系统可以持续发现潜在高价值 AI 技术材料
  - 自动采集内容先进入候选池，而不是直接进入学习流程

#### What to build

实现 GitHub Trending 与 Hacker News 的采集入口，将外部条目规范化为 Candidate 候选输入。采集器只生成候选内容，不创建 Source、不调用 Agent、不生成 Note。

#### Acceptance criteria

- [ ] 新增 GitHub Trending collector
- [ ] 新增 Hacker News collector
- [ ] collector 输出统一 Candidate 创建输入
- [ ] Candidate 记录 title、summary、url、author、published_at、collected_at、tags、external_ref
- [ ] 采集失败返回结构化错误，不产生半成品 Candidate
- [ ] 外部请求可 mock，测试不依赖真实网络
- [ ] 不采集 AI 主题以外的大量泛内容作为主路径
- [ ] 不直接创建 Source
- [ ] 不直接进入 Note 或 Index

#### Blocked by

- Issue 19

---

### Issue 21: Candidate 去重、过滤与评分推荐

- **Type**: AFK
- **Blocked by**: Issue 20
- **User stories covered**:
  - 用户不会被重复或低价值候选淹没
  - 系统能解释候选项为什么值得学习

#### What to build

实现 Candidate 去重、规则过滤和评分推荐。推荐结果只影响 Candidate 状态，不自动进入正式学习流程。

#### Acceptance criteria

- [ ] 根据 canonical URL / external_ref / title slug 做去重
- [ ] 重复 Candidate 不创建新的推荐项
- [ ] 实现基础过滤规则，排除明显不相关内容
- [ ] 实现 score breakdown 四项评分
- [ ] 达到阈值后状态进入 `recommended`
- [ ] 未达阈值或被过滤后状态进入 `dismissed`
- [ ] score reason 说明推荐原因
- [ ] 支持重新评分单个 Candidate
- [ ] 覆盖 dedupe、filter、scoring 单元测试

#### Blocked by

- Issue 20

---

### Issue 22: Candidate 选中并转换为 Source

- **Type**: HITL
- **Blocked by**: Issue 21, Issue 2
- **User stories covered**:
  - 用户可以从推荐候选中选择真正想深入学习的材料
  - 自动采集内容必须经过用户选择才能进入 Source 主流程

#### What to build

实现 `Candidate -> Source` 转换 workflow。用户选中推荐 Candidate 后创建对应 Source，并建立双向引用。

#### Acceptance criteria

- [ ] 支持 `ai-knowledge candidate select <candidate_id>`
- [ ] 只允许 `recommended` Candidate 被选中
- [ ] Candidate 状态流转：`recommended -> selected -> converted`
- [ ] 创建 `Source.status = ingested`
- [ ] Source 使用 `ingest_type = candidate_selected`
- [ ] Source 使用 `origin.type = candidate`
- [ ] 写入 `Source.origin_candidate_id`
- [ ] 写入 `Candidate.converted_source_id`
- [ ] 转换后输出 next action：`ai-knowledge source process <source_id>`
- [ ] 不允许同一 Candidate 重复转换
- [ ] 支持 `--json`

#### Blocked by

- Issue 21
- Issue 2

---

### Issue 23: 自动采集候选池端到端验收

- **Type**: HITL
- **Blocked by**: Issue 20, Issue 21, Issue 22
- **User stories covered**:
  - 用户可以从自动发现的候选材料进入完整学习闭环
  - 产品验证 Candidate 不会绕过讨论和确认门槛

#### What to build

准备自动采集链路的端到端验收，用 mocked collector 或稳定 fixture 跑通：采集、去重、评分、推荐、选中、转 Source，并复用既有 Source -> Note -> Answer 主链路。

#### Acceptance criteria

- [ ] 有 GitHub Trending fixture
- [ ] 有 Hacker News fixture
- [ ] 可以从空 `knowledge/` 生成 recommended Candidate
- [ ] 用户选择后可以转换为 Source
- [ ] 转换后的 Source 可继续 process / understand / discuss / approve / note / index / answer
- [ ] 验收中确认 Candidate 不会直接进入 Index
- [ ] 验收中确认未选中 Candidate 不会创建 Source

#### Blocked by

- Issue 20
- Issue 21
- Issue 22

---

### Issue 24: 导入飞书文档为 Source

- **Type**: AFK
- **Blocked by**: Issue 2
- **User stories covered**:
  - 用户可以把飞书文档作为主动学习资料导入
  - 飞书文档进入与 Markdown/PDF/URL 相同的 Source 主链路

#### What to build

实现飞书文档导入 Source 的输入契约、CLI 与原始内容快照保存。该 issue 只支持用户显式提供的飞书文档，不做知识库搜索发现或批量同步。

#### Acceptance criteria

- [ ] 支持 `ai-knowledge source ingest lark-doc <doc_url_or_token>`
- [ ] `ingest_type = lark_doc`
- [ ] `origin.user_input_type = lark_doc`
- [ ] Source 初始状态为 `ingested`
- [ ] 保存文档 token / URL 元信息
- [ ] 保存可追溯的 raw 快照或 raw metadata
- [ ] 权限不足时返回结构化错误
- [ ] 不支持批量同步整个知识库空间
- [ ] 支持 `--json`

#### Blocked by

- Issue 2

---

### Issue 25: 处理飞书文档 Source 生成 processed artifacts

- **Type**: AFK
- **Blocked by**: Issue 24, Issue 3
- **User stories covered**:
  - 飞书文档可以转换成统一可理解文本证据
  - 后续理解、讨论、Note 与问答链路复用现有能力

#### What to build

扩展 `source process` 支持飞书文档 Source，将文档结构转换为 `clean_text`、`segments`、`metadata`，并保留稳定 evidence locator。

#### Acceptance criteria

- [ ] `source process` 可识别 `lark_doc` Source
- [ ] 生成 `processed/clean_text.md`
- [ ] 生成 `processed/segments.json`
- [ ] 生成 `processed/metadata.json`
- [ ] segment locator 能定位到文档块、标题路径或等价位置
- [ ] metadata 记录文档标题、所有者、更新时间等可用信息
- [ ] 处理失败时 Source 进入 `failed` 并写 `last_error.stage = processing`
- [ ] 不改变 understand / discuss / approve / note / answer 的主语义
- [ ] 支持 `--json`

#### Blocked by

- Issue 24
- Issue 3

---

### Issue 26: 讨论收敛规则检查器

- **Type**: AFK
- **Blocked by**: Issue 6, Issue 7
- **User stories covered**:
  - 用户确认前系统能独立判断讨论是否具备落笔条件
  - Agent 的 ready 建议不能单独决定是否进入正式 Note

#### What to build

实现独立的 discussion convergence checker，用规则校验讨论摘要是否满足最小落笔条件，并接入 `source approve`。

#### Acceptance criteria

- [ ] 新增 convergence checker 模块
- [ ] 检查 `confirmed_points` 非空
- [ ] 检查至少存在价值判断或等价 `why_it_matters` 材料
- [ ] 检查关键不确定性已进入 `open_questions` 或 `unresolved_issues`
- [ ] 检查没有阻塞型 open question 时才允许 approve
- [ ] `discussion_summary.ready_for_approval` 只是输入信号之一
- [ ] `source approve` 使用 checker 返回明确失败原因
- [ ] `/approve` 命令展示 checker 结果
- [ ] 覆盖 convergence 单元测试

#### Blocked by

- Issue 6
- Issue 7

---

### Issue 27: 相关笔记发现与确认

- **Type**: HITL
- **Blocked by**: Issue 10, Issue 11
- **User stories covered**:
  - 用户可以把新知识与既有笔记建立主题、概念或时间关联
  - 相关笔记关系必须可解释、可确认，不由模型静默写入主真相

#### What to build

实现 related notes 候选发现、展示和确认机制。候选可由关键词/metadata/LLM 建议产生，但写入 `related_note_ids` 前需要明确规则或用户确认。

#### Acceptance criteria

- [ ] 能基于 approved Notes 生成 related note 候选
- [ ] 候选包含关联理由
- [ ] Note compose 时可携带 related note 候选上下文
- [ ] 支持用户确认或拒绝 related note
- [ ] 只把确认后的关系写入 `Note.related_note_ids`
- [ ] `note render` 展示相关笔记
- [ ] `answer` 可利用相关笔记扩展 approved Note 上下文
- [ ] 覆盖相关性规则和确认 workflow 测试

#### Blocked by

- Issue 10
- Issue 11

---

### Issue 28: Source / Note 归档工作流

- **Type**: AFK
- **Blocked by**: Issue 10
- **User stories covered**:
  - 用户可以把不再活跃的资料或笔记归档
  - archived Note 不应继续作为当前主知识参与检索

#### What to build

实现 Source 与 Note 的 archive 命令和 workflow。归档不删除原始资料、不重写历史讨论，只改变活跃状态和检索可见性。

#### Acceptance criteria

- [ ] 支持 `ai-knowledge source archive <source_id>`
- [ ] 支持 `ai-knowledge note archive <note_id>`
- [ ] Source 只通过状态机进入 `archived`
- [ ] Note 只通过状态机进入 `archived`
- [ ] 归档不删除 raw、processed、discussion、note.md 或 note.json
- [ ] archived Note 不进入主检索结果
- [ ] archived Note 对历史引用仍可 show
- [ ] 支持 `--json`
- [ ] 覆盖 workflow、retrieval 测试

#### Blocked by

- Issue 10

---

### Issue 29: Note 版本化与 supersede 工作流

- **Type**: HITL
- **Blocked by**: Issue 10, Issue 26
- **User stories covered**:
  - 用户可以在核心结论变化时创建新版 Note
  - 旧版 Note 保留历史价值，但不再代表当前主结论

#### What to build

实现 Note 新版本创建和 supersede workflow。仅当核心结论变化时创建新版本；普通措辞修改仍应更新结构化 Note 后重新 render，而不是新版本。

#### Acceptance criteria

- [ ] 支持创建新版 Note 的 workflow 或命令
- [ ] 新版 Note `version = old.version + 1`
- [ ] 新版 Note 继承 `root_note_id`
- [ ] 新版 Note 写入 `supersedes_note_id`
- [ ] 旧版 Note 状态流转为 `superseded`
- [ ] 旧版 Note 写入 `superseded_by_note_id`
- [ ] superseded Note 不进入当前主检索结果
- [ ] 版本链可通过 `note show` 查看
- [ ] 不允许无确认讨论直接创建新版 approved Note
- [ ] 覆盖版本链 invariant 和 workflow 测试

#### Blocked by

- Issue 10
- Issue 26

---

### Issue 30: Index Entry 生命周期与索引清理

- **Type**: AFK
- **Blocked by**: Issue 28, Issue 29
- **User stories covered**:
  - 主检索层只包含当前有效的 approved Note
  - archived / superseded Note 不会污染后续问答

#### What to build

完善 Index Entry 生命周期管理，使 Note archive、supersede、re-index 时索引状态与 Note 状态保持一致。

#### Acceptance criteria

- [ ] `note index` 不接受 archived / superseded Note
- [ ] Note archive 后对应 index entry 被移除或标记为非主检索
- [ ] Note supersede 后旧版 index entry 被移除或标记为非主检索
- [ ] 重新 index approved Note 时覆盖旧 index entry
- [ ] retrieval 只返回当前 approved 且未归档、未 superseded 的 Note
- [ ] index 清理失败返回结构化错误
- [ ] 覆盖 retrieval 与 index lifecycle 测试

#### Blocked by

- Issue 28
- Issue 29

---

### Issue 31: 向量索引契约与 embedding 生成

- **Type**: AFK
- **Blocked by**: Issue 10
- **User stories covered**:
  - 系统可以为 approved Note 建立语义检索入口
  - `IndexEntry.vector_ref` 从预留字段变成可用引用

#### What to build

定义并实现 Note embedding 生成、向量文件或向量存储引用，以及 `IndexEntry.vector_ref` 的更新策略。该 issue 只负责生成与存储向量，不改变 answer 排序策略。

#### Acceptance criteria

- [ ] 定义 embedding provider 配置，API key 只能来自环境变量
- [ ] 定义 vector artifact 或 vector store 引用格式
- [ ] `note index` 可生成 embedding
- [ ] `IndexEntry.vector_ref` 指向可读取的向量引用
- [ ] embedding 输入只来自 approved Note 主真相字段
- [ ] 不为 draft / archived / superseded Note 生成主向量索引
- [ ] embedding 失败时不把 Note 标记为 approved 失败
- [ ] 测试可 mock embedding provider

#### Blocked by

- Issue 10

---

### Issue 32: 关键词 / metadata / 向量混合检索

- **Type**: AFK
- **Blocked by**: Issue 31, Issue 30
- **User stories covered**:
  - 用户后续提问时能同时利用关键词命中和语义召回
  - 多个相关 Note 能被综合排序，而不是只靠字符串包含

#### What to build

实现 hybrid retrieval，将关键词、metadata 和 vector similarity 合并排序，并保持只检索当前有效的 approved Note。

#### Acceptance criteria

- [ ] retrieval 支持 keyword score
- [ ] retrieval 支持 metadata/tag score
- [ ] retrieval 支持 vector similarity score
- [ ] 定义可解释的合并排序策略
- [ ] top-k 返回包含分数构成或 debug 信息
- [ ] 只返回当前有效 approved Notes
- [ ] 无 vector_ref 时可降级到 keyword/metadata，但必须显式记录降级
- [ ] 覆盖 hybrid retrieval 测试 fixture

#### Blocked by

- Issue 31
- Issue 30

---

### Issue 33: Answer fallback 到未确认材料并显式标注

- **Type**: AFK
- **Blocked by**: Issue 11, Issue 32
- **User stories covered**:
  - 当 approved Note 不足时，系统可以提示存在相关但未确认的材料
  - 用户能区分“没有已确认知识”和“有材料但尚未沉淀为知识”

#### What to build

扩展 answer workflow，在 approved Notes 不足时按优先级补充相关 `discussion_summary`、processed artifacts 或 raw Source 摘要，并在回答中显式标注未确认属性。

#### Acceptance criteria

- [ ] answer 优先使用 approved Notes
- [ ] approved Note 不足时可检索相关 Source / discussion_summary
- [ ] processed/raw Source 只能作为 unconfirmed materials
- [ ] 输出结构包含 `unconfirmed_materials`
- [ ] Answer Agent prompt 明确区分 confirmed 与 unconfirmed
- [ ] 当 approved Note 与 Source 冲突时默认以 approved Note 为准
- [ ] 无 approved Note 但有相关 Source 时明确说明“存在相关材料，但尚未形成已确认知识”
- [ ] 不把未确认材料写入主 index
- [ ] 覆盖 fallback 和冲突处理测试

#### Blocked by

- Issue 11
- Issue 32

---

### Issue 34: 本地异步任务与重试模型

- **Type**: AFK
- **Blocked by**: Issue 12
- **User stories covered**:
  - 长耗时处理可以后台执行并被查询状态
  - 失败任务可以明确重试，而不是依赖用户手动猜测下一步

#### What to build

实现本地 job/task 模型，用于封装预处理、理解生成、Markdown 成稿、索引更新等可异步步骤。P0/P1 命令仍可保留同步模式，但应具备异步执行基础。

#### Acceptance criteria

- [ ] 定义 job schema 与状态：`queued | running | succeeded | failed | canceled`
- [ ] job 记录 target object、operation、created_at、updated_at、last_error
- [ ] 支持 `job list`
- [ ] 支持 `job show <job_id>`
- [ ] 支持 `job retry <job_id>`
- [ ] process / understand / render / index 可作为 job operation
- [ ] job 失败不破坏 Source / Note 主真相边界
- [ ] 支持 `--json`
- [ ] 覆盖 job storage 和 retry 测试

#### Blocked by

- Issue 12

---

### Issue 35: 定时自动采集与自动推进

- **Type**: AFK
- **Blocked by**: Issue 23, Issue 34
- **User stories covered**:
  - 系统可以定期发现新候选材料
  - 自动流程只推进到候选推荐，不绕过用户选择和确认

#### What to build

实现定时采集和可配置自动推进策略。自动化只能覆盖采集、候选评分和非交互预处理等环节，不能绕过 Candidate 选择、讨论确认或 Note approval 门槛。

#### Acceptance criteria

- [ ] 支持配置采集频率
- [ ] 定时运行 GitHub Trending / Hacker News collector
- [ ] 自动执行 dedupe / scoring / recommendation
- [ ] 可选将用户选中的 Source 自动排队 process
- [ ] 不自动把 Candidate 转 Source
- [ ] 不自动 approve Source
- [ ] 不自动 approve Note
- [ ] 采集任务失败可在 job 中查看
- [ ] 覆盖 scheduler 和 safety gate 测试

#### Blocked by

- Issue 23
- Issue 34

---

### Issue 36: 最终预期端到端验收套件

- **Type**: HITL
- **Blocked by**: Issue 25, Issue 27, Issue 30, Issue 33, Issue 35
- **User stories covered**:
  - 产品完整验证从自动发现到长期知识问答的闭环
  - 所有关键门槛都能被回归测试或人工验收覆盖

#### What to build

建立覆盖最终预期能力的端到端验收套件，包含主动导入、自动采集、候选选择、讨论确认、版本治理、混合检索和 fallback 问答。

#### Acceptance criteria

- [ ] 覆盖 Markdown / PDF / URL / Lark Doc 主动导入 happy path
- [ ] 覆盖 GitHub Trending / Hacker News 自动采集 fixture
- [ ] 覆盖 Candidate 推荐与选中转 Source
- [ ] 覆盖 discussion convergence checker
- [ ] 覆盖 Note archive 与 supersede
- [ ] 覆盖 related notes 确认
- [ ] 覆盖 hybrid retrieval
- [ ] 覆盖 answer fallback 到 unconfirmed materials
- [ ] 验收中确认未确认材料不会进入主知识层
- [ ] 验收中确认 archived / superseded Note 不进入当前主检索

#### Blocked by

- Issue 25
- Issue 27
- Issue 30
- Issue 33
- Issue 35

---

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

### P2+ / Final Expected Capability

```text
18 depends on 1
19 depends on 18
20 depends on 19
21 depends on 20
22 depends on 21, 2
23 depends on 20, 21, 22

24 depends on 2
25 depends on 24, 3

26 depends on 6, 7
27 depends on 10, 11
28 depends on 10
29 depends on 10, 26
30 depends on 28, 29

31 depends on 10
32 depends on 31, 30
33 depends on 11, 32

34 depends on 12
35 depends on 23, 34
36 depends on 25, 27, 30, 33, 35
```

## 4. Notes

- P0 issue 拆分覆盖 Markdown 主动学习闭环。
- P1 聚焦 PDF 主动导入与用户显式提供的公开 URL 导入，不改变下游知识主链路。
- URL 导入不包含自动爬站、批量抓取、搜索发现、登录态页面或 JS 渲染兜底。
- P2+ issue 拆分覆盖最终预期能力，但仍应按阶段逐步实现，不应一次性混入 P0/P1。
- Candidate 仍不进入主知识层；只有用户选择后转换为 Source，且经过讨论确认和 QA 的 approved Note 才能进入主检索。
- 向量检索只增强 retrieval，不改变 `note.json` 作为正式知识主真相的边界。
- Answer fallback 可以引用未确认材料，但必须显式标注，且不得把未确认材料写入主 index。
- HITL issue 包括交互式讨论、候选选择、相关笔记确认、版本化判断和端到端验收。
