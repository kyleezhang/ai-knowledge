# AI 学习助手 P0 Issue Breakdown

## 1. 文档目标

本文档基于 `specs/implementation.md`，将 P0 Markdown 主动学习闭环拆分为可执行 issue 草案。

P0 范围：

```text
Markdown -> Source -> Processed Artifacts -> Draft Understanding
-> Discussion Summary -> Approval -> Note JSON -> Note Markdown
-> QA -> Approved Note -> Index Entry -> Answer
```

P0 不包含：

- PDF 支持
- GitHub Trending / Hacker News 自动采集
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

## 3. Dependency Map

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

## 4. Notes

- 当前 issue 拆分只覆盖 P0。
- P2 自动采集相关命令和 Candidate workflow 暂不拆分。
- PDF 支持暂不拆分。
- 向量检索暂不拆分。
- HITL issue 只有交互式讨论 REPL 与 P0 端到端验收。
