# Extended Capabilities Smoke / Acceptance Guidance

## 目的

本文档汇总 P0 Stable 之外的扩展能力 smoke / acceptance 边界。扩展能力已经在 CLI 中暴露，但按阶段标记为 Beta 或 Experimental，不是 P0 Stable 成功的必要条件。

| Phase             | Stability    | Coverage                                                        |
| ----------------- | ------------ | --------------------------------------------------------------- |
| P1                | Beta         | PDF、显式公开 URL、飞书单文档导入与处理                         |
| P2                | Experimental | Candidate collect/score/select、本地 schedule / task automation |
| P3                | Experimental | `note index --vector`、`answer --hybrid`                        |
| Explicit fallback | Non-default  | `answer --fallback-unconfirmed` 标记未确认 secondary evidence   |

扩展能力必须继续遵守核心 gates：

```text
Source -> Processed Artifacts -> Draft Understanding -> Discussion Summary
-> Approval -> Note JSON -> Note Markdown -> QA -> Approved Note -> Index Entry -> Answer
```

Candidate 不得直接进入主 Index 或 answer evidence；vector/hybrid 只用于定位 approved Notes；fallback 只在显式开启时使用结构化未确认材料，并必须标注 unconfirmed 与 limitations。

## P1 Beta 输入扩展

参考：`tests/p1-end-to-end-acceptance.manual.md`。

覆盖：

- `ai-knowledge source ingest pdf <file>`
- `ai-knowledge source ingest url <public_url>`
- `ai-knowledge source ingest feishu-doc <doc_url_or_token>`

通过标准：

- 导入阶段只创建 `Source`，不直接创建 Note 或 Index。
- 处理阶段生成 `processed/clean_text.md`、`processed/segments.json`、`processed/metadata.json`。
- PDF / URL / 飞书 Source 复用 P0 下游 discussion、Note、QA、Index 和 default answer gates。
- URL 是显式公开 URL fetch，不做 crawling、站内链接发现或批量同步。
- 飞书是显式单文档导入，不做知识库、空间或文件夹同步。

## P2 Experimental Candidate 与本地自动化

参考：`tests/candidate-pool-end-to-end-acceptance.manual.md`。

覆盖：

- `ai-knowledge candidate collect github-trending`
- `ai-knowledge candidate collect hacker-news`
- `ai-knowledge candidate score <candidate_id>`
- `ai-knowledge candidate select <candidate_id>`
- `ai-knowledge schedule ...`
- `ai-knowledge task ...`

通过标准：

- Candidate collect 只创建 Candidate JSON。
- recommended Candidate 经用户 select 后才转换为 Source。
- duplicate、dismissed、unselected Candidate 不得创建 Source。
- Candidate 不得直接创建 main Index Entry。
- Candidate 不得直接作为 answer evidence。
- schedule / task automation 不得 select Candidate、approve Source、compose Note 或 approve Note，除非用户显式执行相应 gate。

## P3 Experimental Vector / Hybrid

覆盖：

- `ai-knowledge note index <note_id> --vector`
- `ai-knowledge answer "<question>" --hybrid`

通过标准：

- vector indexing 只能从 approved `note.json` 派生 vector metadata。
- vector index 是 retrieval metadata，不是知识主真相。
- hybrid retrieval 必须从 approved main Index Entry 出发，过滤 draft / archived / superseded / missing Notes。
- Answer Agent 接收 approved Notes，而不是 vector chunk text 或 retrieval metadata。
- 缺少 embedding provider 配置时，默认 keyword-only indexing 不受影响；hybrid 可降级到 keyword / metadata 并报告 vector unavailable reason。

## Explicit Fallback

覆盖：

```bash
ai-knowledge answer "<question>" --fallback-unconfirmed
```

通过标准：

- 默认 `answer` 无 approved Note 命中时，只报告没有相关已确认知识。
- 显式 fallback 才可读取 processed Source artifacts、`draft_understanding` 或 `discussion_summary`。
- fallback evidence 必须包含 `confirmation_status = unconfirmed`、`material_type`、`source_id`、`source_title`、`source_status`、`evidence_ref`、`excerpt`、`limitations`。
- raw artifacts、Candidate、`note.md`、vector chunk text 和 retrieval metadata 不得作为 fallback evidence。
- fallback 不得创建 Note、Index Entry、vector index，也不得修改 Candidate、Source 或 Note 状态。

## 真实 LLM Smoke

统一入口：

```bash
pnpm test:smoke
```

该 smoke 是本地显式触发，不并入默认 `pnpm test`。它可能覆盖 P0 Stable、P1 Beta 与 P3 Experimental 路径。输出应按 path 展示 diagnostics，例如：

- path label
- phase / stability label
- workdir
- source id
- note id
- answer summary 或 conclusion

运行前确认：

- 已配置所需 provider API key，例如 `DEEPSEEK_API_KEY`。
- 若覆盖 vector / hybrid，已配置 `VOYAGE_API_KEY`。
- 该检查会消耗 token，且 provider 输出可能有波动。
- 未配置 key 时应报告 skipped，不得伪装为 passed。
