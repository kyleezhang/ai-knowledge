## 1. 规格与项目文档对齐

- [x] 1.1 更新 `AGENTS.md`，增加 capability phase map，并将 P0/P1/P2/P3 能力标记为 Stable/Beta/Experimental
- [x] 1.2 更新 `specs/implementation.md` 中 P0-only 与 P1/P2/P3 阶段描述，明确当前已暴露能力的阶段和稳定性
- [x] 1.3 更新 `specs/workflow.md` 的 answer/retrieval 描述，澄清默认 answer 只使用 approved Notes，显式 fallback 才可使用标记后的未确认材料
- [x] 1.4 检查 `specs/prd.md`、`specs/schema.md` 是否存在与 phase map 冲突的表述；如需要，仅做边界措辞修正，不改变对象 schema

## 2. CLI 帮助与用户可见语义

- [x] 2.1 更新 CLI help 或命令描述，使 `source ingest markdown` 标记为 `P0 Stable`
- [x] 2.2 更新 CLI help 或命令描述，使 `source ingest pdf`、`source ingest url`、`source ingest feishu-doc` 标记为 `P1 Beta`
- [x] 2.3 更新 CLI help 或命令描述，使 `candidate ...` 与 scheduled automation 相关命令标记为 `P2 Experimental`
- [x] 2.4 更新 CLI help 或命令描述，使 `note index --vector`、`answer --hybrid` 标记为 `P3 Experimental`
- [x] 2.5 检查默认 `answer` 与 `--fallback-unconfirmed` 输出文案，确保 approved Note evidence 与 unconfirmed fallback evidence 分区或字段明确区分

## 3. 验收与 smoke 文档拆分

- [x] 3.1 将 P0 Markdown-only 验收说明与扩展能力 smoke/acceptance 说明拆分为不同文档，或在现有文档中加入明确章节分区
- [x] 3.2 确保 P0 验收说明只要求 Markdown 主链路与默认 approved-Note answer，不要求 PDF、URL、Feishu、Candidate、vector、hybrid 或 fallback
- [x] 3.3 为扩展能力 smoke/acceptance 文档补充 phase/stability 标签，并说明这些能力不放宽 Source -> Discussion -> Note -> QA -> Index gates
- [x] 3.4 更新 `pnpm test:smoke` 相关说明，明确真实 LLM smoke 是本地显式触发、可能消耗 token、输出按 path 展示 diagnostics

## 4. 测试更新

- [x] 4.1 更新或新增 CLI help / output 相关测试，覆盖 P1/P2/P3 标签展示
- [x] 4.2 更新 answer fallback 测试，确认默认 answer 不读取未确认材料，`--fallback-unconfirmed` 输出包含 unconfirmed 标签和 limitations
- [x] 4.3 更新 acceptance/smoke 文档或测试断言，确认 P0 与 extended coverage 的名称和范围不混淆
- [x] 4.4 确认现有 P0 acceptance 仍能在 fake agents / fake REPL 下离线通过

## 5. 验证与收尾

- [x] 5.1 运行 OpenSpec 状态/校验命令，确认 `align-implemented-capabilities` change artifacts 有效
- [x] 5.2 运行 `pnpm typecheck`
- [x] 5.3 运行 `pnpm test`
- [x] 5.4 运行 `pnpm lint`
- [x] 5.5 运行 `pnpm format:check`
- [x] 5.6 运行 `pnpm build`
- [x] 5.7 总结本次变更影响范围，明确没有新增依赖、没有改变 knowledge filesystem schema、没有放宽核心 workflow gates
