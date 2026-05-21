## Context

当前仓库已经有稳定的 fake-agent 端到端验收能力，可以验证主 workflow、对象落盘和关键 gate，但它无法覆盖真实 provider 配置、真实模型输出漂移、prompt 与 `generate_json` 在生产级 provider 下的真实表现。用户当前在本地 shell 环境中通过 `.zshrc` 提供 `DEEPSEEK_API_KEY`，因此本地环境具备运行真实 LLM smoke test 的条件。

同时，这类真实集成验证天然有几个约束：它会消耗 token、有响应时间、可能受 provider 波动影响、且结果文本不应被要求逐字稳定。因此它不适合进入默认 `pnpm test` 或 CI 阻塞链路，而更适合作为显式触发的本地 / 预发布检查。

## Goals / Non-Goals

**Goals:**
- 提供一条本地显式触发的真实 LLM smoke test，使用固定 fixture 验证关键链路可用性。
- 让 smoke test 在检测到 `DEEPSEEK_API_KEY` 时才运行；未配置时默认跳过或返回非失败型提示。
- 保持 smoke test 与默认 `pnpm test`、CI 阻塞链路解耦。
- 只校验关键状态与关键产物，不要求逐字稳定输出。
- 明确人工使用说明与前置条件，降低误用成本。

**Non-Goals:**
- 不把真实 LLM smoke test 并入默认单元测试或 CI required checks。
- 不要求 smoke test 覆盖所有边界条件或替代现有 fake-agent 回归套件。
- 不改变正式 workflow 的 schema 校验、状态机或知识真相边界。
- 不引入新的 provider、浏览器自动化或外部托管测试基础设施。

## Decisions

1. **将真实 LLM 验收设计为单独的显式脚本入口，而不是默认 test target。**
   - 决策：增加独立入口，例如 `pnpm test:smoke`，由本地用户手动运行。
   - Rationale: 真实 provider 依赖会引入成本和波动，不应影响默认开发反馈回路。
   - Alternatives considered:
     - 并入 `pnpm test`：会让普通测试失去可重复性。
     - 并入 CI：会把外部网络和 provider 波动引入主阻塞链路。

2. **smoke test 只校验关键控制面，不做逐字结果断言。**
   - 决策：验证 `processed artifacts` 存在、`draft_understanding` 非空、discussion / approval 路径可推进、Note 草稿或关键控制面生成成功，并可选校验 answer 是否引用 approved Note；不要求具体生成文案完全稳定。
   - Rationale: 真实模型输出存在合理波动，关键价值在于验证链路和协议，而不是固定文本。
   - Alternatives considered:
     - 逐字断言输出：极易因模型自然波动而频繁误报。

3. **未配置 `DEEPSEEK_API_KEY` 时默认跳过，而不是报 hard failure。**
   - 决策：脚本应检测 `DEEPSEEK_API_KEY`；若缺失，则输出清晰 skip 提示并以非失败方式结束，或仅在明确 `--require-env` 模式下失败。
   - Rationale: smoke test 是本地显式工具，不应因为环境缺失而破坏普通开发流程。
   - Alternatives considered:
     - 无 key 直接失败：会让“显式但可选”的本地 smoke test 体验变差。

4. **使用固定 fixture 和隔离工作目录，避免污染真实知识库。**
   - 决策：smoke test 从临时目录启动，复制固定 Markdown fixture，所有产物写入隔离的 `knowledge/` 路径，结束后可保留或清理。
   - Rationale: 真实集成验证不应污染仓库内已有数据或用户长期知识库。
   - Alternatives considered:
     - 复用项目根下 `knowledge/`：容易引入状态泄漏与误判。

5. **把真实 LLM smoke test 定位为对 fake-agent 验收的补充，而不是替代。**
   - 决策：继续保留现有 `end-to-end-acceptance` 的 fake-agent 默认基线，同时新增真实 provider smoke test 作为第二条、低频但高价值的集成检查路径。
   - Rationale: fake-agent 测试负责稳定回归，真实 smoke test 负责暴露集成层问题，两者职责不同。
   - Alternatives considered:
     - 用 smoke test 替代 fake-agent E2E：会让回归信号变贵且不稳定。

## Risks / Trade-offs

- [Risk] 真实 LLM smoke test 会有 token 成本与响应延迟。 → Mitigation: 仅本地显式触发，使用固定小 fixture，限制验证范围。
- [Risk] provider 波动可能导致偶发失败。 → Mitigation: 只断言关键状态与关键产物，不做逐字输出比较，并保留失败日志便于人工判断。
- [Risk] 用户误以为 smoke test 等同于确定性回归测试。 → Mitigation: 在命令命名、文档和输出中明确标注其为本地非阻塞 smoke test。
- [Risk] 若把真实讨论步骤完全自动化，可能卡在 approval 语义上。 → Mitigation: smoke test 可采用受控最小对话脚本，重点验证链路可推进，而不是自由探索式对话质量。

## Migration Plan

- 无数据迁移。
- 新增脚本、fixture 和说明文档即可。
- 如需回滚，只需删除 smoke test 入口和相关 fixture / 文档；默认测试链路保持不变。

## Open Questions

- None.
