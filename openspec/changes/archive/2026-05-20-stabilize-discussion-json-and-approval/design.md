## Context

当前 discussion 阶段把“给用户的自然语言回复”和“给系统的结构化 `discussion_summary_update`”绑定在单次严格 JSON 输出里。实现上，`generate_json()` 直接对整段模型文本执行 `JSON.parse()`，discussion workflow 再把解析结果直接作为本轮结构化收敛输入。因此只要模型在正常对话中输出了 code fence、前后缀说明或轻微格式漂移，就会触发 `LLM output is not valid JSON`，把一次原本可恢复的对话轮次升级成 `AGENT_FAILED`。

另一方面，approve 语义当前过度绑定模型的 `ready_for_approval` 建议信号。即便用户已经明确表达“可以这样确认”或主动执行 `/approve` / `source approve`，只要模型未在某轮 summary update 中把 `ready_for_approval` 置为 `true`，系统就仍然拒绝 approve。这使用户显式确认在交互上弱于模型建议，不符合 P0 的 HITL 预期。

这次修复只针对短期稳定性与可用性，不重构 discussion 架构，也不改变“必须有 processed artifacts、必须有 confirmed structure、必须有用户确认，才能进入正式 Note”这些核心 gate。

## Goals / Non-Goals

**Goals:**
- 为 discussion 阶段增加受限 JSON 容错提取，降低可恢复格式漂移导致的 `AGENT_FAILED`。
- 保持 Zod schema 校验为硬门槛；容错只发生在“文本到 JSON 载荷”的提取阶段，不放宽结构化要求。
- 让用户显式 approve 动作在已有 `confirmed_points` 的前提下优先于模型 `ready_for_approval` 建议，减少 approve 摩擦。
- 改进 `/approve` 和 `source approve` 的反馈信息，让用户清楚知道阻塞点是缺少 confirmed points、仍有待确认问题，还是只是模型还未建议 ready。
- 为 discussion JSON 容错和 approval UX 增加回归测试。

**Non-Goals:**
- 不拆分 discussion reply 和 summary update 为两阶段 agent。
- 不新增独立确认对象、approval policy engine 或多阶段 summarizer。
- 不改变 `Source -> Note` 的主真相边界。
- 不引入 Web UI、数据库、额外外部服务或新的输入来源。

## Decisions

1. **在 `generate_json` 中增加“受限提取”而不是放松 schema。**
   - 决策：当模型输出不是裸 JSON 时，先尝试提取单个 fenced JSON block；若不存在，再尝试提取单个顶层 JSON object；提取成功后仍必须通过原始 Zod schema。
   - Rationale: 这样可以恢复最常见的格式漂移，同时维持“结构无效就失败”的硬边界。
   - Alternatives considered:
     - 直接接受任意自然语言并做启发式字段填充：会让 discussion_summary 主真相失控。
     - 完全不容错：当前已经证明用户体验过脆。

2. **把 `ready_for_approval` 从硬门槛降为建议信号，但不取消 `confirmed_points` 门槛。**
   - 决策：`source approve` 与 REPL `/approve` 在用户显式确认路径下，若 `confirmed_points` 非空且 Source 处于 `discussing`，可允许进入 approve，即使 `ready_for_approval` 仍为 `false`。
   - Rationale: 用户显式确认应比模型建议更高优先级，但仍要保留最小结构化收敛要求，避免“空确认”直接落笔。
   - Alternatives considered:
     - 继续把 `ready_for_approval` 作为硬门槛：这正是当前摩擦来源。
     - 完全不看 discussion_summary，只靠用户一键通过：会削弱结构化收敛边界。

3. **在 REPL 与 CLI 错误提示中显式区分阻塞原因。**
   - 决策：对 `/approve` 与 `source approve` 增加更细粒度反馈，例如：缺少 `confirmed_points`、仍有 `open_questions` / `unresolved_issues`、或“模型尚未建议 ready，但用户可显式确认推进”。
   - Rationale: 当前统一提示 `Discussion is not ready for approval.` 信息量太低，用户无法判断下一步要做什么。
   - Alternatives considered:
     - 维持单句错误：成本低，但无法解决交互困惑。

4. **把短期修复限制在 discussion / approval 路径，不扩散到其他 agent。**
   - 决策：本次只要求 `discussion_agent` 使用的 `generate_json` 受益于容错，并修复 `discussion-convergence` / `source approve` 语义；不借机修改 understand / note / answer 的确认逻辑。
   - Rationale: 保持 change 小而独立，实现风险更低。
   - Alternatives considered:
     - 一次性给所有 agent 增加复杂恢复策略：收益不如范围扩大得快。

## Risks / Trade-offs

- [Risk] 过度 JSON 提取可能误把非目标文本当成 JSON。 → Mitigation: 只接受单个 fenced JSON block 或单个顶层 JSON object，提取后仍必须通过 Zod schema。
- [Risk] 降低 approve 门槛可能让讨论在模型尚未完全收敛时被用户推进。 → Mitigation: 仍要求 `confirmed_points` 非空，并保留显式用户确认作为必须条件。
- [Risk] discussion 提示逻辑变复杂，CLI 文案测试更脆。 → Mitigation: 测试聚焦行为和关键提示片段，不逐字绑定整段输出。

## Migration Plan

- 无数据迁移。
- 现有 `Source` / `Note` / `Index Entry` schema 不变。
- 已存在的 discussion.jsonl 与 discussion_summary 可直接继续使用；修复只影响后续讨论轮次与 approve 判定。

## Open Questions

- None. 长期 discussion 架构拆分应放回 `specs/issues.md` 作为后续迭代，不纳入本次 change。
