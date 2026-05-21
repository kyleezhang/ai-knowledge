# 本地真实 LLM Smoke Test

## 目的

这条 smoke test 用真实 `DEEPSEEK_API_KEY` 在本地显式跑一遍固定 fixture 的关键主链路，用来补充 fake-agent 验收覆盖不到的真实 provider / prompt / JSON 协议问题。

## 重要说明

- 该检查 **仅本地显式触发**，不会并入默认 `pnpm test`。
- 该检查会消耗 token，并可能受 provider 波动影响。
- 该检查 **不要求逐字稳定输出**，只校验关键状态与关键产物。
- 未配置 `DEEPSEEK_API_KEY` 时，脚本默认跳过并返回非阻塞结果。

## 运行方式

```bash
pnpm test:smoke
```

如需保留临时工作目录以便排查：

```bash
node scripts/local-llm-smoke.mjs --keep-workdir
```

## 前置条件

- shell 环境中已配置 `DEEPSEEK_API_KEY`
- 不要把 API key 写入仓库文件
- 本地环境可访问 deepseek provider

## 验证范围

固定 fixture：`tests/p0-end-to-end-acceptance.fixture.md`

关键主链路：

```text
source ingest -> process -> understand -> discuss -> approve -> note compose -> lint -> approve -> index -> answer
```

关键检查项：

- `processed/clean_text.md` / `segments.json` / `metadata.json` 已生成
- `draft_understanding` 非空
- Source 可推进到 `approved_for_note`
- Note 可推进到 `draft` / `approved`
- answer 输出包含 `## 综合结论`

## 非目标

- 不替代默认 fake-agent E2E
- 不做逐字输出比较
- 不作为 CI required check
