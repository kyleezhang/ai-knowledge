## Context

`related-notes` capability 已经定义：related note candidates 必须来自 approved Notes，并且写入 `Note.related_note_ids` 前需要用户或 workflow 显式确认。当前实现已经可以发现 related candidates，并在 `note compose --related-note` 时把确认关系写入 Note。

`answer-grounding` capability 则要求答案优先基于 approved Notes，hybrid retrieval 只负责定位 approved Notes，retrieval metadata 不能替代 approved Note evidence。

本设计把两者连接起来：answer retrieval 直接命中的 approved Notes 作为 seed，seed 的 `related_note_ids` 可以扩展一跳 related approved Notes，作为补充上下文参与 Answer Agent，但不改变知识边界。

## Goals / Non-Goals

**Goals:**

- 在 answer workflow 中使用 `Note.related_note_ids` 做 one-hop related approved Notes expansion。
- 区分 direct matches 与 related expansions，并在 JSON/debug 输出中可解释。
- 保证 direct matches 排序优先，related notes 作为补充上下文排在 direct notes 后。
- 保证 related expansion 只加载当前 approved Notes，并跳过 draft / archived / superseded / missing / unloadable Notes。
- 对 related expansion 做去重和数量上限，避免上下文膨胀。
- 保持 Answer Agent 只基于 approved `note.json` 作答。

**Non-Goals:**

- 不自动创建、修改或推断 `related_note_ids`。
- 不做多跳图遍历、PageRank、centrality、community detection 或图数据库。
- 不用 LLM 动态判断 relatedness。
- 不从 raw Source、`draft_understanding`、discussion log 或 `note.md` 扩展 confirmed answer context。
- 不改变 `answer --fallback-unconfirmed` 的显式 fallback 语义。
- 不把 related expansion 默认提升为比 direct match 更强的证据。

## Decisions

### Decision 1: 只做 one-hop expansion

首版只从 direct matched Notes 的 `related_note_ids` 扩展一跳 related Notes：

```text
query -> direct approved matches -> related_note_ids -> related approved notes
```

不递归加载 related 的 related。

Rationale: one-hop 充分利用用户已确认关系，同时避免图遍历导致上下文膨胀、噪声传播和难以解释的证据链。

### Decision 2: direct role 优先于 related role

如果一个 Note 既直接检索命中，又通过另一个 Note 的 `related_note_ids` 被扩展，则该 Note 只保留 direct role。

Rationale: direct match 与用户问题之间有检索证据；related expansion 是补充上下文。保留 direct role 可以避免 evidence weight 混乱。

### Decision 3: related expansion 只接受 current approved Notes

related id 指向的 Note 必须当前状态为 `approved` 才能加入 answer context。missing、draft、archived、superseded、unloadable Note 都跳过，并在 debug 中记录。

Rationale: `related_note_ids` 是历史写入的关系，目标 Note 后续可能 archived 或 superseded。answer 必须以当前有效 approved Note 为边界。

### Decision 4: 增加 explicit cap

首版使用固定默认上限，例如：

```text
related_context_limit = 5
related_per_direct_note_limit = 2
```

实现可先作为 workflow/retrieval option，CLI 暂不暴露复杂参数；JSON debug 记录 skipped/truncated 数量。

Rationale: 本地 CLI 需要可预测的上下文大小，尤其 Answer Agent 输入可能包含多个结构化 Note。

### Decision 5: Retrieval metadata 与 answer evidence 分离

retrieval result 可以包含：

```ts
retrieval_role: 'direct' | 'related'
related_via_note_id?: string
related_reason?: string
```

但 Answer Agent 的 confirmed evidence 仍是 loaded approved Notes。相关关系说明可用于排序、debug 或展示，不替代 Note 的正式内容。

Rationale: 遵守现有 `Index Entry` / retrieval metadata 不是知识真相的规则。

## Proposed Data Shape

可选实现形态：

```ts
type AnswerRetrievalRole = 'direct' | 'related';

type AnswerRetrievalResult = HybridRetrievalResult & {
  retrieval_role: AnswerRetrievalRole;
  related_via_note_id?: string;
  related_via_title?: string;
};
```

对于默认 keyword retrieval，也可以构造统一的 retrieval result，避免 `default` 与 `hybrid` 两套 output shape 分裂。

Answer Agent 输入可采用两种兼容路径之一：

1. **最小改动**：保持 `approved_notes: Note[]`，排序为 direct first、related after；role 只在 workflow JSON 中返回。
2. **更清晰**：扩展 agent input 为 `{ note, retrieval_role, related_via_note_id }[]`，同时更新 prompt，明确 related notes 是补充上下文。

推荐首版采用方案 1，降低 agent schema 变更风险；但 JSON 输出必须保留 role 供调试。

## Flow

```text
answer workflow
  │
  ├─ direct retrieval
  │   ├─ default keyword / metadata
  │   └─ explicit hybrid keyword / metadata / vector
  │
  ├─ related expansion
  │   ├─ collect related_note_ids from direct notes
  │   ├─ dedupe direct note ids
  │   ├─ load notes by id
  │   ├─ keep only status=approved
  │   └─ cap related count
  │
  ├─ Answer Agent input
  │   └─ approved Notes: direct first, related after
  │
  └─ workflow result
      ├─ matched_note_ids
      ├─ retrieval_results with role/debug
      └─ answer
```

## Compatibility / Migration

- Existing `note.json` schema does not need migration; `related_note_ids` already exists.
- Existing notes without related notes behave exactly as before.
- Existing `answer` human-readable output can remain stable; `--json` gains more debug metadata.
- `answer --fallback-unconfirmed` remains explicit and separate. Related approved notes are confirmed evidence; fallback unconfirmed materials remain secondary and labeled.
- Archived / superseded related Notes are skipped at query time; no background cleanup required in this change.

## Risks / Trade-offs

- [Risk] related notes introduce off-topic context. Mitigation: one-hop only, cap count, direct-first ordering, JSON debug.
- [Risk] Answer Agent overweights related notes. Mitigation: direct-first ordering and prompt/input wording that related notes are supplementary.
- [Risk] JSON output shape churn. Mitigation: add fields rather than removing existing `retrieval_results` fields.
- [Risk] related ids become stale after archive/supersede. Mitigation: runtime approved-only filter and skipped debug reason.

## Verification Strategy

- Domain/retrieval tests for role schema, dedupe and cap.
- Workflow tests for related approved Note inclusion and non-approved related Note skipping.
- CLI tests for `answer --json` role/debug output.
- Existing answer fallback tests must continue to prove unconfirmed materials remain labeled and separate.
- Run typecheck, Vitest, lint, format check and build.
