## 1. Domain Contracts

- [x] 1.1 新增 `UnconfirmedEvidence`、`AnswerFallbackOptions`、`AnswerFallbackResult` 类型，字段保持 snake_case。
- [x] 1.2 新增 Zod schema 校验 `confirmation_status = unconfirmed`、`material_type`、`source_id`、`source_title`、`source_status`、`evidence_ref`、`excerpt`、`limitations`。
- [x] 1.3 增加 domain 校验函数，拒绝未标注 unconfirmed、空 evidence_ref、空 excerpt、空 limitations 的 fallback evidence。
- [x] 1.4 增加 domain 测试覆盖完整标注、缺失标注、非法 material_type、空限制说明。

## 2. Fallback Retrieval

- [x] 2.1 新增 fallback retrieval 入口，只在显式启用时从 Source storage 读取候选。
- [x] 2.2 支持从 processed artifacts 的 segments / clean_text 生成 unconfirmed evidence，并保留 processed evidence_ref。
- [x] 2.3 支持从 `draft_understanding` 生成 `material_type = draft_understanding` 的 unconfirmed evidence。
- [x] 2.4 支持从 discussion summary 生成 `material_type = discussion_summary` 的 unconfirmed evidence。
- [x] 2.5 禁止读取 raw artifacts 和 Candidate 作为 fallback answer evidence。
- [x] 2.6 增加 fallback retrieval 测试覆盖显式启用、raw 禁止、excerpt 限制、source trace、Source / Note 状态不变。

## 3. Agent Contract

- [x] 3.1 扩展 answer agent input schema，区分 `approved_notes` 与 `unconfirmed_materials`。
- [x] 3.2 更新 answer prompt，要求 unconfirmed materials 只能作为未确认参考，并在输出中保留限制说明。
- [x] 3.3 扩展 answer output schema / validation，确保使用 fallback 时 `unconfirmed_materials` 字段包含材料引用与限制。
- [x] 3.4 增加 agent 测试覆盖 approved 与 unconfirmed input 分离、未确认材料标注、无真实 LLM 调用。

## 4. Workflow Integration

- [x] 4.1 扩展 answer workflow 输入，增加显式 `fallback_to_unconfirmed` 开关，默认保持 false。
- [x] 4.2 在无 approved Note 命中且 fallback 显式启用时调用 fallback retrieval。
- [x] 4.3 确保 workflow 传给 Answer Agent 的 primary approved Notes 与 secondary unconfirmed materials 分离。
- [x] 4.4 确保 fallback 不创建 Note、不写 main Index Entry、不改变 Source / Note 状态。
- [x] 4.5 增加 workflow 测试覆盖默认不 fallback、显式 fallback、agent input 分离、状态不变、无 eligible material。

## 5. CLI Integration

- [x] 5.1 扩展 `ai-knowledge answer`，增加显式 `--fallback-unconfirmed` 选项。
- [x] 5.2 扩展非 JSON 输出，单独显示 unconfirmed materials 段落和限制说明。
- [x] 5.3 扩展 JSON 输出，包含 fallback evidence、material_type、source_id、evidence_ref、limitations。
- [x] 5.4 增加 CLI 测试覆盖默认行为、显式 fallback、JSON 输出、无 eligible fallback。

## 6. Spec And Documentation Sync

- [x] 6.1 确认 `answer-grounding`、`source-processing`、`draft-understanding`、`discussion-convergence` delta 与 `answer-fallback` 新能力一致。
- [x] 6.2 如实现中调整 CLI 选项名、fallback 触发条件或 eligible material 范围，同步更新本 change 的 design/spec/tasks。

## 7. Verification

- [x] 7.1 运行 `openspec status --change "answer-fallback-to-labeled-unconfirmed-material"` 确认 artifacts apply-ready。
- [x] 7.2 运行 OpenSpec validation，确保 `answer-fallback` 与相关 delta specs 可归档。
- [x] 7.3 运行 TypeScript typecheck。
- [x] 7.4 运行 Vitest 测试。
- [x] 7.5 运行 ESLint / Prettier 检查。
- [x] 7.6 运行 build，确认 CLI 产物可生成。