# P0 Stable 端到端验收与本地真实 LLM Smoke

## 目的

本文件只定义 **P0 Stable** 的验收边界：Markdown 主动学习闭环与默认 approved-Note answer。它用于确认最小稳定主链路仍然成立，不要求 PDF、URL、飞书文档、Candidate、vector、hybrid 或 fallback-unconfirmed 能力。

P0 Stable 主链路：

```text
Markdown -> Source -> Processed Artifacts -> Draft Understanding
-> Discussion Summary -> Approval -> Note JSON -> Note Markdown
-> QA -> Approved Note -> Index Entry -> default Answer
```

## 阶段边界

- P0 Stable：Markdown 主动导入、Source processing、draft understanding、discussion approval、Note compose/render/lint/approve/index、默认 keyword / metadata answer。
- P1 Beta：PDF、显式公开 URL、飞书单文档导入；见 `tests/extended-capabilities.smoke.md` 和 `tests/p1-end-to-end-acceptance.manual.md`。
- P2 Experimental：Candidate 候选池与本地 schedule / task automation；见 `tests/extended-capabilities.smoke.md` 和 `tests/candidate-pool-end-to-end-acceptance.manual.md`。
- P3 Experimental：`note index --vector` 与 `answer --hybrid`；见 `tests/extended-capabilities.smoke.md`。

扩展能力不能放宽 P0 gates：没有 processed artifacts 不得生成 `draft_understanding`；没有讨论收敛和用户确认不得生成 formal Note；没有 QA / lint passed 不得 approve Note；没有 approved Note 不得进入主 Index。

## 默认自动化验收

默认自动化验收使用 fake agents / fake REPL，不依赖真实 LLM、真实公网或 provider API key：

```bash
pnpm test -- tests/cli/p0-acceptance-cli.test.ts
```

关键检查项：

- 从空 `knowledge/` 导入 `tests/p0-end-to-end-acceptance.fixture.md`。
- 生成 `processed/clean_text.md`、`processed/segments.json`、`processed/metadata.json`。
- 生成 `draft_understanding` 与 `discussion_summary`。
- 在 source approval 前拒绝 `note compose`。
- 生成 `note.json` 与 `note.md`。
- 在 `note lint` passed 前拒绝 `note approve`。
- approved Note 才能创建主 index entry。
- 默认 `answer` 只引用 approved Notes；无命中时报告没有相关已确认知识。

## 人工 P0 CLI 验收步骤

1. 准备临时目录：

   ```bash
   WORKDIR="$(mktemp -d)"
   cd "$WORKDIR"
   ```

2. 初始化本地知识目录：

   ```bash
   ai-knowledge init
   ```

3. 导入 Markdown fixture：

   ```bash
   ai-knowledge source ingest markdown /path/to/tests/p0-end-to-end-acceptance.fixture.md
   ```

   记录输出中的 `<source_id>`。

4. 处理并生成初步理解：

   ```bash
   ai-knowledge source process <source_id>
   ai-knowledge source understand <source_id>
   ```

5. 启动讨论并确认：

   ```bash
   ai-knowledge source discuss <source_id>
   ```

   至少进行一轮讨论，检查 `/summary`、`/draft`、`/status`，收敛后通过 `/approve` 或退出后执行：

   ```bash
   ai-knowledge source approve <source_id>
   ```

6. 生成、QA、批准并索引 Note：

   ```bash
   ai-knowledge note compose <source_id>
   ai-knowledge note lint <note_id>
   ai-knowledge note approve <note_id>
   ai-knowledge note index <note_id>
   ```

7. 默认提问：

   ```bash
   ai-knowledge answer "agent memory boundary approved notes"
   ```

## 真实 LLM smoke 入口

真实 provider smoke 只维护一个入口：

```bash
pnpm test:smoke
```

该入口是 **本地显式触发**，不会并入默认 `pnpm test`。它可能覆盖 P0 Stable 与 P1/P2/P3 扩展能力；扩展覆盖必须在输出或文档中标明 phase/stability label。运行前确认：

- shell 中已配置所需 provider API key，例如 `DEEPSEEK_API_KEY`；如果执行 vector/hybrid smoke，还需要 `VOYAGE_API_KEY`。
- 不要把 API key 写入仓库文件。
- 该检查会消耗 token，并可能受 provider 波动影响。
- 该检查不要求逐字稳定输出，只校验状态推进、schema 校验、QA gate、approved Note 与 answer grounding 是否成立。

未配置所需 provider API key 时，smoke 应明确报告 skipped，不得伪装成 passed。
