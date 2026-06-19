## Context

当前代码与 OpenSpec 已经体现出一个事实：AI 学习助手不再只是最初的 Markdown-only P0。现有能力已经覆盖 P1 PDF/URL/飞书导入、P2 Candidate/定时自动化、P3 Vector/Hybrid 检索等方向，但部分项目说明仍将这些能力描述为“后续再做”，导致阶段边界、验收名称和用户可见命令语义不一致。

这次设计选择先做“能力边界治理”，而不是继续新增 runtime 功能。核心目标是让文档、CLI help、验收说明和 OpenSpec requirements 都用同一套阶段语言描述当前系统：

```text
P0 Stable
  Markdown 主动学习闭环
  approved Note keyword/metadata answer

P1 Beta
  PDF ingest/process
  explicit public URL ingest/process
  Feishu single-doc ingest/process

P2 Experimental
  Candidate collect/score/select
  scheduled local automation

P3 Experimental
  vector indexing
  hybrid retrieval
```

边界治理必须继续保护项目最重要的知识分层：

```text
Candidate -> Source -> Draft Understanding -> Discussion Summary
          -> Approved Note -> Index Entry -> Answer
```

## Goals / Non-Goals

**Goals:**

- 统一 `AGENTS.md`、`specs/implementation.md`、OpenSpec specs、CLI help 和验收说明中的阶段命名。
- 明确每个用户可见能力的阶段和稳定性标签：Stable / Beta / Experimental。
- 明确 default answer 只基于 approved Notes；`--fallback-unconfirmed` 是显式 opt-in 且输出必须标记未确认来源。
- 拆分或重命名 P0 smoke/acceptance 文档，使 Markdown-only P0 与 PDF/URL/Candidate/Vector/Hybrid 扩展能力分开表达。
- 保留现有命令，不做破坏性删除。

**Non-Goals:**

- 不新增新的 ingestion 类型、collector、embedding provider 或检索算法。
- 不把 Candidate、raw Source、`draft_understanding` 或 discussion summary 升级为主知识层。
- 不改变 filesystem schema 或核心对象字段。
- 不改变 `note.json` 作为正式知识主真相、`note.md` 作为导出视图的规则。
- 不建设 Web UI、数据库、批量飞书同步、网页 crawling 或外部发布能力。

## Decisions

### Decision 1: 引入“阶段 + 稳定性”双标签，而不是只用 P0/P1/P2/P3

仅使用 P0/P1/P2/P3 容易表达“时间顺序”，但不能表达当前实现的可靠程度。因此文档应同时记录：

- Phase：P0 / P1 / P2 / P3
- Stability：Stable / Beta / Experimental

建议映射：

| Phase | Stability | Capabilities |
|---|---|---|
| P0 | Stable | Markdown 主动导入、process、understand、discuss、approve、compose/lint/approve/index、keyword/metadata answer |
| P1 | Beta | PDF、显式公开 URL、Feishu 单文档导入 |
| P2 | Experimental | Candidate collect/score/select、scheduled local automation |
| P3 | Experimental | Vector indexing、hybrid retrieval |

Alternative considered：把所有已实现能力都直接升为 Stable。拒绝该方案，因为 Candidate、Vector/Hybrid 等能力虽然已有实现和测试，但仍需要更多产品语义、失败路径和用户体验治理。

### Decision 2: 保留现有超 P0 命令，但在文档与 help 中标记阶段

移除或隐藏已实现命令会打断已有测试与用户探索；直接保留但不标记阶段又会继续制造边界混乱。因此采用“保留 + 标记”：

```text
source ingest markdown       P0 Stable
source ingest pdf            P1 Beta
source ingest url            P1 Beta
source ingest feishu-doc     P1 Beta
candidate ...                P2 Experimental
note index --vector          P3 Experimental
answer --hybrid              P3 Experimental
answer --fallback-unconfirmed Explicit fallback, non-default
```

CLI help 可以在后续实现中采用分组或标签文本，不要求改变命令结构。

### Decision 3: Default answer 的主证据层必须是 approved Notes

默认 `ai-knowledge answer "<question>"` 必须继续只使用 approved Index Entries 定位 approved `note.json`。如果没有匹配的 approved Note，应明确说明“没有相关已确认知识”，而不是自动回查 Source、draft 或 discussion。

显式 fallback 的语义为：

```text
answer --fallback-unconfirmed
  approved Notes: primary evidence
  structured unconfirmed materials: secondary evidence
  raw artifacts: not eligible
  Candidates: not eligible
```

输出必须分区或字段化展示：

- approved note evidence
- unconfirmed fallback evidence
- limitations

Alternative considered：当 approved Notes 不足时默认 fallback 到 discussion/source。拒绝该方案，因为它会造成知识漂移，并削弱“用户确认后才成为知识”的产品核心。

### Decision 4: P0 acceptance 与扩展 smoke 分开命名

验收文档应避免“P0 smoke”同时覆盖 PDF/URL/vector/hybrid。建议：

```text
tests/p0-end-to-end-acceptance.smoke.md
  只描述 Markdown-only P0 主链路

tests/extended-capabilities.smoke.md
  描述 P1/P2/P3 的本地显式 smoke 或 manual guidance
```

如果暂时不重命名文件，也必须在文档开头明确：哪些段落属于 P0 Stable，哪些属于扩展能力。

### Decision 5: OpenSpec capability spec 以行为边界为中心，不按代码文件拆分

本变更涉及多个文档和 CLI 文案，但 spec 应围绕用户可观察行为：

- `capability-phase-governance`：新增阶段治理要求。
- `answer-grounding`：修改默认回答和 hybrid/fallback 的证据边界。
- `answer-fallback`：修改显式 fallback 标签和不可变更状态约束。
- `end-to-end-acceptance`：修改验收范围命名和 smoke 入口说明。

## Risks / Trade-offs

- [Risk] 标记 Beta/Experimental 可能让用户觉得功能“不完整”。
  → Mitigation：文档强调这些能力已可用，但稳定性和产品语义仍在收口；不移除命令。

- [Risk] 只改文档不改代码，可能仍存在 CLI 输出不够清晰的问题。
  → Mitigation：tasks 中包含 CLI help/output 文案对齐和测试检查，但不引入新功能。

- [Risk] OpenSpec 现有 specs 已经包含 P1/P2/P3 要求，和 `specs/implementation.md` 的 P0-only 描述不一致。
  → Mitigation：以本变更为桥接，更新 implementation/spec docs 的阶段表述，使现状成为显式事实。

- [Risk] fallback 输出变严格可能需要调整既有测试断言。
  → Mitigation：保持 opt-in flag 不变；只要求标签、分区和 limitations 更明确。

## Migration Plan

1. 更新 OpenSpec specs，新增 `capability-phase-governance`，修改 answer 与 acceptance 相关 requirements。
2. 更新项目文档：`AGENTS.md`、`specs/implementation.md`、必要时 `specs/workflow.md`。
3. 更新 smoke/acceptance 文档命名或内容分区。
4. 更新 CLI help 或输出文案，给 P1/P2/P3 命令增加 Beta/Experimental 标签。
5. 运行 `openspec status` / `openspec validate`、typecheck、test、lint 和 format check。

Rollback 策略：

- 本变更主要是文档与文案治理；如需回滚，可恢复相关文档和 CLI help 文案，不涉及数据迁移。

## Open Questions

- `extended-capabilities.smoke.md` 是否应拆成 `p1-ingestion.smoke.md`、`p2-candidate.smoke.md`、`p3-retrieval.smoke.md`，还是先保持一个扩展文档？
- CLI help 是否要默认隐藏 Experimental 命令，还是显示但加标签？当前建议显示但加标签。
- `P1 Beta` 中飞书文档导入是否应和 PDF/URL 放在同一个手工验收文档中，还是单独保留内部环境说明？