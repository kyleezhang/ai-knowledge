## Context

当前 P0 已支持 Markdown 导入为 `Source`，但后��� `draft_understanding` 不能直接消费 raw material，必须先有明确的 processed artifacts。`source-processing` 需要把 `raw/original.md` 转换为可验证、可追踪、可被 agent 输入预算控制的标准中间产物，同时保持 raw material、processing artifacts、draft understanding 与 approved Note 之间的边界。

该变更跨越 processing、storage、workflow、domain、CLI 与 tests 多层，但不引入新的知识对象，也不改变 `Note` 或索引语义。

## Goals / Non-Goals

**Goals:**

- 为 P0 Markdown Source 实现固定 processed artifacts 三件套：`clean_text.md`、`segments.json`、`metadata.json`。
- 通过 workflow 强制 `ingested -> processing -> processed` 状态流转。
- 将 artifact 路径登记到 `source.processing_artifacts`，且路径相对 Source 目录。
- 处理失败时保留 `raw/original.md`，写入 `last_error.stage = processing` 并进入 `failed`。
- 提供 `ai-knowledge source process <source_id>` CLI，人类可读输出与 `--json` 输出都来自 workflow result。
- 为 processor、artifact 写入、workflow 成功/失败路径和 CLI 行为补测试。

**Non-Goals:**

- 不支持 PDF、飞书文档、网页、图片或视频处理。
- 不引入 LLM、Agent 或 draft understanding 生成逻辑。
- 不生成正式 `Note`，不写入 index。
- 不引入数据库、后台队列、Web UI 或向量检索。
- 不改写或删除 `raw/original.md`。

## Decisions

1. **Markdown processor 输出固定三件套。**
   - Decision: P0 processor 只输出 `processed/clean_text.md`、`processed/segments.json`、`processed/metadata.json`。
   - Rationale: 下游 understand workflow 可以依赖稳定 artifact key：`clean_text`、`segments`、`metadata`，避免从 raw Markdown 猜结构。
   - Alternatives considered: 只输出一个 normalized Markdown 文件。放弃原因是后续 agent 需要 segment 级 evidence ref 与 metadata，单文件不利于测试和截断。

2. **segment 使用确定性规则而非 LLM。**
   - Decision: 按 Markdown 标题层级和段落块生成 segment，保留顺序、标题路径和文本内容；无标题内容归入默认根 section。
   - Rationale: Processing 层不应依赖真实 LLM，且 P0 需要可重复测试。
   - Alternatives considered: 调用 LLM 生成 semantic chunks。放弃原因是会把 processing 与 agent 边界混在一起，并增加不稳定性。

3. **workflow 负责状态与 Source 更新。**
   - Decision: processor 只返回候选 artifacts 内容，storage 只负责读写 artifact，workflow 负责状态流转、`processing_artifacts` 登记、`last_error` 和 next action。
   - Rationale: 符合现有 layering rules，避免 processor 或 storage 偷改业务对象。
   - Alternatives considered: processor 直接写文件并更新 Source。放弃原因是会破坏 domain/storage/workflow 职责边界。

4. **失败统一落到 `failed` 并记录 processing stage。**
   - Decision: 读取 raw、解析、写 artifact 或保存 Source 任一步失败时，workflow 尽量将 Source 转为 `failed` 并写 `last_error.stage = processing`。
   - Rationale: 用户可以通过 `source show` 看到失败阶段，raw material 仍可用于排查或重试。
   - Alternatives considered: 保持 `processing` 状态等待人工修复。放弃原因是 CLI P0 没有后台任务管理，悬挂的 `processing` 状态不利于恢复。

5. **CLI 不拼接路径，不直接读写 artifacts。**
   - Decision: `source process` CLI 只解析参数、调用 workflow、展示 `next_actions` 或错误，并支持 `--json`。
   - Rationale: CLI 层不应承载业务逻辑或路径逻辑。

## Risks / Trade-offs

- [Risk] Markdown 结构复杂时 deterministic segment 可能不够语义化。→ Mitigation: P0 只承诺可理解的稳定表示，不承诺最佳语义 chunk；后续可在不改变 artifact 契约的前提下优化 segment 规则。
- [Risk] 多文件写入无法完整事务化，可能出现 artifacts 写入成功但 Source 保存失败。→ Mitigation: P0 接受有限事务边界；workflow 返回失败并保留 raw/artifacts 供排查，Source 最终状态以 `source.json` 为准。
- [Risk] metadata 提取过度会引入不可靠推断。→ Mitigation: metadata 只包含可从 Markdown 或 Source 明确得到的信息，如 title、headings、links、counts，不生成未支持的语义结论。
- [Risk] 重复执行 process 可能覆盖 processed artifacts。→ Mitigation: P0 前置状态只接受 `ingested`，普通重复执行会被拒绝；retry 语义后续在明确失败恢复时处理。

## Migration Plan

- 这是 P0 未完成链路的增量能力，不需要迁移历史 approved Notes 或 index。
- 已处于 `ingested` 的 Markdown Source 可执行 `ai-knowledge source process <source_id>` 生成 artifacts。
- 已处于其他状态的 Source 不自动重处理；若未来支持 retry，应单独定义失败恢复规则。

## Open Questions

- P0 `segments.json` 的最小字段是否只包含 `id`、`order`、`heading_path`、`text`，还是需要立即加入 `source_ref` / `char_range`；建议实现时采用能支持 evidence refs 的最小稳定字段。
- `metadata.json` 是否需要记录原始 frontmatter；建议只记录解析出的非敏感、可 JSON 序列化字段，避免把任意 frontmatter 原样当作可信业务字段。

## Verification Strategy

- 运行 OpenSpec 校验确认 proposal/design/spec/tasks 结构有效。
- 运行 TypeScript typecheck、Vitest、ESLint/Prettier。
- 单元测试覆盖 Markdown processor 的 clean text、segment 顺序、metadata 提取。
- workflow 测试覆盖成功流转、非 `ingested` 状态拒绝、raw 缺失失败、processor 失败进入 `failed`。
- CLI smoke test 覆盖人类可读输出、`--json` 输出和 next action。
