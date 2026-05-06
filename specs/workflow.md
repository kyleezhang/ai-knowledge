# AI 学习助手 Workflow Spec

## 1. 文档目标

本文档定义 AI 学习助手的核心工作流、状态流转规则、关键对象之间的关系，以及各阶段的输入输出约束。

这份文档的目标不是描述实现细节，而是回答以下问题：

- 一份资料进入系统后会经历哪些阶段
- 每个阶段的目标、输入、输出是什么
- 用户与 Agent 在什么时机发生互动
- 哪些内容可以进入长期知识库
- 后续问答应优先依赖什么知识层

本文档服务于后续的 `agents.md`、`skills/` 设计以及 `to-issues` 拆解。

对象字段、目录落盘与最小字段约束以 `specs/schema.md` 为准；本文件主要定义工作流、状态语义和阶段边界。

## 1.1 MVP 对象模型与落盘约定

MVP 阶段采用以下核心对象与目录约定。字段级定义、示例结构和最小校验约束见 `specs/schema.md`。

```text
knowledge/
  candidates/
  sources/
  notes/
  index/
```

- `Candidate`
  仅服务自动采集链路的轻量候选对象，不进入主知识层。
- `Source`
  进入学习流程的正式资料对象，是处理、理解、讨论和确认的主工作对象。
- `Note`
  已确认知识的主真相对象；`note.json` 为主真相，`note.md` 为导出视图。
- `Index Entry`
  面向后续问答的检索入口，仅主索引 `approved` 状态的 `Note`。
- `Draft Understanding`
  不独立建模为主对象，作为 `Source` 内嵌结构存在。
- `Discussion Summary`
  不独立建模为主对象；摘要内嵌在 `Source` 中，原始消息单独落盘。

### 目录与文件组织

- `Candidate`
  每个对象一个 JSON 文件，例如：
  `knowledge/candidates/2026/05/cand_20260506_github_trending_openmanus.json`
- `Source`
  每个对象一个目录，例如：
  `knowledge/sources/2026/05/src_20260506_pdf_context-engineering/`
- `Note`
  每个对象一个目录，固定包含：
  - `note.json`
  - `note.md`
- `Index Entry`
  每个 `Note` 一个索引文件，例如：
  `knowledge/index/2026/05/note_20260506_ai-coding-agent.index.json`

### Source 与 Note 的落盘约定

`Source` 目录固定包含：

```text
<source-dir>/
  source.json
  discussion.jsonl
  raw/
  processed/
```

- `raw/`：原始导入文件、副本或抓取快照
- `processed/`：清洗文本、分段、元数据提取等处理中间产物
- `discussion.jsonl`：原始讨论消息流
- `source.json`：Source 主控制面，包含状态、处理中间产物索引、`draft_understanding` 与 `discussion_summary`

`Note` 目录固定包含：

```text
<note-dir>/
  note.json
  note.md
```

- `note.json`：主真相，承载确认后的结构化知识
- `note.md`：高质量 Markdown 导出视图

## 2. 核心原则

### 2.1 先理解，再讨论，再沉淀
系统不能将原始资料直接视为最终知识。每份资料都必须先经过处理与初步理解，再通过用户讨论收敛，最后才形成正式知识笔记。

### 2.2 只有确认后的笔记进入主知识库
原始资料、处理中间产物、讨论草稿都不能直接作为长期知识库的主事实来源。只有用户确认后的笔记才具备主知识地位。

### 2.3 原始资料与正式知识必须分层
系统必须显式区分原始来源、处理结果、讨论记录与正式笔记，避免后续问答时发生知识漂移。

### 2.4 讨论是工作流的一等环节
讨论不是简单的 UI 交互补充，而是从“信息”到“知识”的必要步骤。

## 3. 核心对象

系统中的核心对象包括：

- `Candidate`
  自动采集链路中的轻量候选对象，用于候选池、评分、推荐和转 `Source`。`Candidate` 不进入主知识层。
- `Source`
  进入学习流程的正式资料对象。来源于用户主动导入，或由自动采集候选项经用户选中后转换而来。
- `Draft Understanding`
  系统基于处理结果生成的待讨论理解草稿，不作为独立主对象落盘，而是内嵌在 `Source` 中。
- `Discussion Summary`
  用户与 Agent 围绕某个 `Source` 讨论后的结构化摘要，不作为独立主对象落盘，而是内嵌在 `Source` 中；原始消息流单独记录。
- `Note`
  经过用户确认后生成的正式知识对象。`note.json` 是主真相，`note.md` 是导出视图。
- `Index Entry`
  用于支持后续检索与问答的索引对象。MVP 中仅主索引 `approved` 状态的 `Note`。

## 4. 总体工作流

系统的主工作流由 8 个阶段组成：

1. 资料进入系统
2. 资料预处理
3. 初步理解生成
4. 进入讨论
5. 用户确认
6. 正式笔记生成
7. 笔记入库与关联
8. 后续知识检索与问答

## 4.1 对象关系与主真相边界

### 4.1.1 Candidate -> Source

- 自动采集内容先进入候选池，形成 `Candidate`
- 候选项先完成去重、过滤、评分和推荐
- 只有当用户选中推荐项后，系统才立即创建对应的 `Source`
- `Candidate` 与 `Source` 采用双向映射：
  - `Candidate.converted_source_id`
  - `Source.origin_candidate_id`

### 4.1.2 Source -> Note

- `Source` 是处理、理解、讨论和确认阶段的主工作对象
- `Source` 与 `Note` 的关系在模型上允许一对多，但 MVP 交互默认只生成一个主 `Note`
- 若核心结论发生变化，可基于原 `Source` 生成新的版本 `Note`
- MVP 不支持围绕同一 `Source` 的并列主题拆分笔记作为常规路径

### 4.1.3 Note 的主从关系

- `note.json` 是正式知识的主真相
- `note.md` 是根据 `note.json` 生成的高质量导出视图
- 用户确认的是结构化结论，而不是 Markdown 文案本身
- Markdown 成稿允许补全表达，但不得新增未确认结论

## 5. 状态机定义

### 5.0 Candidate 状态

每份 `Candidate` 至少应具备以下状态：

- `new`
  刚被采集入候选池，尚未完成评分或推荐
- `recommended`
  已达到推荐阈值，进入推荐列表，等待用户决定是否投入学习流程
- `dismissed`
  已被过滤掉或被用户明确忽略，不进入正式学习流程
- `selected`
  已被用户选中，准备或正在转换为 `Source`
- `converted`
  已成功转换为 `Source`，完成候选层职责

### 5.1 Source 状态

每份 `Source` 至少应具备以下状态：

- `ingested`
  已进入系统，完成 `Source` 创建，但尚未开始预处理
- `processing`
  正在进行解析、抽取、转录、OCR 或标准化
- `processed`
  已得到可供理解的标准化结果，且已生成 `processing_artifacts`
- `understanding_ready`
  已生成待讨论的 `draft_understanding`，可进入讨论
- `discussing`
  正在与用户围绕该 `Source` 进行讨论；此时 `discussion_summary` 持续更新
- `approved_for_note`
  讨论已收敛，且用户已明确确认当前结构化结论可落笔
- `noted`
  已基于确认结论生成至少一个 `Note`
- `archived`
  已归档，不再参与活跃流程
- `failed`
  处理失败，需要重试或人工干预

### 5.2 Note 状态

每份 `Note` 至少应具备以下状态：

- `draft`
  已生成 `note.json` 与 `note.md`，但尚未完成最终入库或导出质量检查
- `approved`
  已确认并通过必要 QA，进入主知识库与主检索层
- `archived`
  已归档，不再作为主要活跃知识
- `superseded`
  已被更新版本替代；保留历史引用价值，但不再作为该主题的当前主版本

### 5.3 Discussion Summary 状态与信号

每个 `Source` 的 `discussion_summary` 至少应具备以下阶段标记：

- `open`
  讨论已开启，仍在进行
- `waiting_user`
  当前等待用户回复、补充判断或补充资料
- `ready_for_approval`
  Agent 依据收敛清单判断讨论已经足够，可请求用户确认
- `closed`
  讨论已结束，并与结果 `Note` 建立关联

除状态外，`discussion_summary` 还必须具备以下结构化信号：

- `summary_version`
  当前讨论摘要版本号，用于标识本轮确认所基于的摘要版本
- `confirmed_points`
  当前已经形成共识的结论点
- `open_questions`
  仍需用户补充判断的问题
- `unresolved_issues`
  资料本身的信息缺口、冲突点或暂未解决的问题
- `next_prompts`
  建议进入下一轮讨论的切入问题
- `ready_for_approval`
  显式布尔信号，表示当前结构化结论是否已达到可请求确认的门槛

## 6. 详细阶段说明

## 6.1 阶段一：资料进入系统

### 目标
将自动采集内容或用户主动提供资料转化为统一的待处理对象。

### 输入

- 自动采集内容
  GitHub Trending、Hacker News
- 用户主动提供内容
  飞书文档、Markdown、PDF

### 输出

- 自动采集链路：先生成 `Candidate`
- 用户主动导入链路：直接生成新的 `Source`
- 来源元数据
- 对于 `Source`，初始状态为 `ingested`

### 关键规则

- 每份资料必须有唯一标识
- 每份资料必须记录接入方式、内容类型、接入时间、标题或标识信息
- 自动采集内容必须先进入候选池，完成评分与推荐后，由用户选中再转换为 `Source`
- 用户主动导入资料不经过候选池，直接创建 `Source`
- `Source` 必须显式记录：
  - `ingest_type`
  - `content_type`
  - `origin`
  - 必要时的 `origin_candidate_id`

## 6.2 阶段二：资料预处理

### 目标
把不同模态资料转换为统一的、可供理解的标准表示。

### 输入

- `Source`

### 输出

- 一组写入 `processed/` 的处理中间产物
- 更新后的 `Source` 状态 `processed`
- `source.json` 中可追踪的 `processing_artifacts`

### 处理内容

- Markdown / 飞书文档：结构化文本抽取、层级清洗、链接保留
- PDF：元数据提取、章节划分、正文抽取
- 链接类动态：标题、摘要、作者、时间、主题标签

### 关键规则

- 预处理结果必须保留与原始资料的映射关系
- `Source` 目录中的 `raw/` 必须尽量保留原始导入文件或抓取快照
- `processed/` 中的中间产物必须通过 `processing_artifacts` 索引字段显式登记
- 预处理失败不应直接丢弃资料，应进入 `failed` 并允许重试
- 处理结果应尽量统一结构，便于后续理解和索引

## 6.3 阶段三：初步理解生成

### 目标
基于处理结果生成一份待讨论的理解草稿，而不是最终结论。

### 输入

- `Processed Asset`
- 相关历史笔记和主题上下文

### 输出

- 一个内嵌于 `source.json` 的 `draft_understanding`
- 更新后的 `Source` 状态 `understanding_ready`

### 草稿内容建议

- 资料的核心观点
- 这份资料为什么重要
- 新概念、新方法或新工具
- 与已有知识的可能联系
- 当前仍不明确的问题
- 建议与用户讨论的切入点

### 关键规则

- `draft_understanding` 必须显式标注不确定性，不能假装已经形成可靠结论
- `draft_understanding` 至少应包含：
  - `summary`
  - `key_points`
  - `uncertainties`
  - `discussion_starters`
  - `generated_at`
- 草稿可以结合已有知识，但不能用已有知识覆盖原始资料
- 预处理完成后，系统应自动生成 `draft_understanding`

## 6.4 阶段四：进入讨论

### 目标
通过 Agent 与用户的多轮交流，把草稿理解转化为被双方认可的知识结论。

### 输入

- `Draft Understanding`
- `Processed Asset`
- 历史笔记与上下文

### 输出

- 更新后的 `discussion.jsonl` 原始消息流
- 更新后的 `source.json.discussion_summary`
- 更新后的 `Source` 状态 `discussing`

### 讨论方式

- Agent 先给出理解草稿
- Agent 主动发起第一轮讨论，提出澄清问题、比较问题或挑战性问题
- 用户对重点、误解、价值判断和应用意义进行反馈
- Agent 根据反馈修正理解，并逐步收敛到稳定结论

### 关键规则

- 讨论必须绑定单个 `Source`，但允许引用历史 `Note` 作为上下文
- 讨论必须围绕“理解”和“判断”，而不仅是复述摘要
- 如果资料本身信息不足，Agent 应允许提出“需要补充资料”而非强行总结
- 原始消息必须保留在 `discussion.jsonl` 中
- 结构化讨论摘要必须回写 `discussion_summary`
- `discussion_summary` 至少应维护：
  - `discussion_status`
  - `summary_version`
  - `confirmed_points`
  - `open_questions`
  - `unresolved_issues`
  - `next_prompts`
  - `ready_for_approval`

## 6.5 阶段五：用户确认

### 目标
获得用户明确许可，将当前讨论结果沉淀为正式笔记。

### 输入

- 已收敛的讨论结论
- `discussion_summary`

### 输出

- `Source` 状态更新为 `approved_for_note`
- `discussion_summary.discussion_status` 更新为 `ready_for_approval` 或 `closed`
- 显式确认结构化结论可用于生成 `Note`

### 确认信号

以下类型的信号可视为确认候选：

- 用户明确说“可以落笔”
- 用户明确说“按这个结论生成笔记”
- 用户点击或执行某个确认动作

### 关键规则

- 用户确认的是当前结构化结论，而不是 Markdown 草稿
- 没有明确确认，不应自动生成正式笔记
- 系统应支持用户在确认前继续追问或修改结论
- 进入可确认状态前，讨论至少应满足以下收敛条件：
  - 已形成核心结论
  - 已形成价值判断
  - 关键不确定性已显式列出
  - 最近一轮未推翻核心理解
  - 已具备生成 `Note` 的最小材料
- 若讨论长期无法收敛，应允许挂起，而不是强行生成低置信度笔记

## 6.6 阶段六：正式笔记生成

### 目标
将经过确认的结构化结论生成一份正式 `Note`，并导出为高质量 Markdown 笔记。

### 输入

- 确认后的结构化结论
- `discussion_summary`
- `Source` 与 `processing_artifacts`

### 输出

- 一个新的 `Note` 目录
- `note.json`
- `note.md`
- 初始 `Note` 状态 `draft`

### 笔记内容建议

- 标题
- 日期
- 来源概览
- 为什么值得关注
- 核心概念
- 讨论后的结论
- 我的当前理解
- 未解决问题
- 相关笔记
- 来源链接

### 关键规则

- `Note` 的主真相是 `note.json`，`note.md` 只是导出视图
- Markdown 成稿由专门的成稿步骤负责，允许补全表达，但不得新增未确认结论
- 成稿后必须经过规则型 QA / lint，再决定是否进入 `approved`
- 用户若要求审阅修改，应优先修改结构化 `Note` 再重新渲染 Markdown
- `Note` 必须保留来源信息，并显式记录 `approval_context`
- `Note` 必须体现“讨论后的结论”，而不只是来源摘要
- `Note` 至少应包含以下主真相字段：
  - `conclusions`
  - `why_it_matters`
  - `current_understanding`
  - `open_questions`
  - `related_note_ids`
  - `source_refs`
- `Note` 必须显式记录版本关系字段：
  - `version`
  - `root_note_id`
  - `supersedes_note_id`
  - `superseded_by_note_id`
- 仅当核心结论变化时，才应创建新版本 `Note`

## 6.7 阶段七：笔记入库与关联

### 目标
把笔记纳入长期知识库，并建立与来源和其他笔记之间的关联。

### 输入

- `Note`

### 输出

- 写入知识目录的 `note.json` 与 `note.md`
- 更新后的 `Note` 状态 `approved`
- 新的相关笔记关系
- 更新后的 `Index Entry`

### 关键规则

- 只有 `approved` 状态的 `Note` 能进入主知识检索层
- 系统应建立 `Note` 与 `Source` 的结构化映射
- 系统应支持笔记之间的主题关联、时间关联和概念关联
- `Note` 应显式保存 `related_note_ids`
- `Note` 应显式保存 QA / quality check 结果，用于区分已确认知识与已通过导出检查的产物

## 6.8 阶段八：后续知识检索与问答

### 目标
让系统能够基于已沉淀知识回答未来问题，而不是每次重新从原始资料开始。

### 输入

- 用户问题
- `Index Entry`
- 已确认 `Note`
- 必要时补充相关 `Source` / `discussion_summary`

### 输出

- 结构化回答
- 命中的相关笔记与引用

### 检索优先级

1. 优先检索 `approved` 状态的 `Note`
2. 如果 `Note` 信息不足，再引用相关 `discussion_summary`
3. 如果仍不足，再回查原始资料或处理中间产物

### 关键规则

- MVP 的主检索层仅围绕 `approved` `Note` 构建
- 检索策略应采用“关键词 / 元数据过滤 + 向量召回”混合方式
- 回答默认应先给出综合结论，再列相关 `Note` / `Source` 指向
- 当命中多个相关 `Note` 时，应优先做跨 `Note` 综合回答
- 未确认讨论内容只可作为补充引用，且必须显式标注未确认
- 当 `approved` `Note` 与 `Source` 冲突时，默认以 `approved` `Note` 为准，并提示存在冲突
- 回答时必须明确区分：
  - 没有相关已确认知识
  - 存在相关材料，但尚未形成已确认知识
- 如果问题超出知识库已有范围，系统应诚实说明不足

## 7. 两类主工作流

## 7.1 自动采集工作流

适用于 GitHub Trending、Hacker News 等自动来源。

### 流程

1. 定时采集候选内容，创建 `Candidate`
2. 对候选内容进行去重、过滤与规则评分
3. 达到阈值的候选项进入推荐列表，状态更新为 `recommended`
4. 用户选中推荐项后，状态更新为 `selected`，并立即创建对应 `Source`
5. `Candidate` 转换完成后，状态更新为 `converted`
6. `Source` 进入预处理、理解、讨论与笔记生成流程

### 特点

- 自动来源必须先经过“候选池”阶段
- “高价值”采用规则评分为主、LLM 辅助解释
- 不是每条采集内容都必须进入完整讨论和落笔流程
- 用户是否选中推荐项，是自动采集内容进入正式学习流程的关键门槛

## 7.2 用户主动学习工作流

适用于飞书文档、Markdown、PDF 等用户主动提供材料。

### 流程

1. 用户导入资料
2. 系统立即建立 `Source`
3. 自动异步进入预处理
4. 预处理完成后自动生成 `draft_understanding`
5. 系统主动发起第一轮讨论
6. 用户确认后生成 `Note` 与 Markdown 笔记

### 特点

- 用户主动提供的资料不经过候选池
- 用户主动提供的资料通常默认优先级更高
- 这条流程更强调深度理解与沉淀

## 8. 失败与回退路径

系统应定义至少以下异常路径：

- 资料解析失败
  进入 `failed`，允许重试或改用替代处理链路
- 讨论未收敛
  保持 `discussing` 状态，或进入挂起语义，不进入正式笔记生成
- 用户改变结论
  允许在笔记生成前回退到讨论阶段
- 旧笔记被新结论替代
  仅当核心结论变化时创建新版本，并将旧笔记标记为 `superseded`
- 成稿 QA 未通过
  `Note` 保持 `draft`，修正结构化内容或重新渲染 Markdown 后再重试

## 9. 工作流约束

### 9.1 必须异步的环节

- 自动采集
- 文件预处理
- 初步理解生成
- Markdown 成稿
- 索引更新

### 9.2 必须同步或显式交互的环节

- 理解草稿展示
- 讨论与澄清
- 用户确认
- 正式笔记生成触发

### 9.3 不可跳过的关键门槛

- 没有预处理结果，不能生成理解草稿
- 没有讨论收敛和明确确认，不能生成正式知识笔记
- 没有通过规则型 QA / lint，`Note` 不能进入 `approved`
- 没有 `approved` 状态，不能进入主知识检索层

## 10. 供后续设计使用的接口边界

为了方便后续拆分 Agent 与 Skills，工作流层面建议保留以下边界：

- `collect_candidates() -> Candidate[]`
- `select_candidate(candidate_id) -> Source`
- `ingest(source_input) -> Source`
- `process(source_id) -> processing_artifacts`
- `understand(source_id) -> draft_understanding`
- `discuss(source_id, user_message) -> discussion_summary_update`
- `approve(source_id) -> approval_result`
- `compose_note(source_id) -> Note`
- `index_note(note_id) -> Index Entry`
- `answer(question) -> grounded_answer`

这些边界描述的是职责，不代表最终必须采用某一种技术实现方式。

## 11. 待进一步细化的问题

- `Candidate`、`Source`、`Note`、`Index Entry` 的完整 JSON schema 是否单独沉淀为独立 spec
- `quality_checks` 的具体规则集合与失败恢复策略如何定义
- `Index Entry` 中 `vector_ref` 的实现与更新策略如何定义
- 飞书文档导入的正文抽取边界如何进一步约束
- 新版本 `Note` 的触发提示与用户交互细节如何设计
- 相关笔记关系是人工确认、规则生成还是模型建议优先

## 12. 总结

AI 学习助手的核心不是把资料丢进模型后立刻生成总结，而是建立一条严格的知识流转路径：

`Candidate -> Source -> Draft Understanding -> Discussion Summary -> Approved Note -> Index Entry`

只有这样，系统才能从“会总结的资料处理器”成长为“真正参与学习、并持续积累知识的 AI 学习助手”。