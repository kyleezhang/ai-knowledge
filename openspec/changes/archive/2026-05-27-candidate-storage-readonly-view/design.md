## Context

Candidate domain schema/type 已经存在，`ai-knowledge init` 也会创建 `knowledge/candidates/` 目录，但系统还没有 Candidate repo、list/show workflow 或 CLI。下一步需要让自动采集后续工作有一个可持久化、可只读查看的候选池基础，同时继续保持 Candidate 与 Source/Note/Index 的边界。

本变更实现 Candidate 的本地 JSON 存储和只读查看，不实现采集器、评分推荐或 Candidate -> Source。Candidate 仍不是正式知识，不能进入 answer retrieval 或 main index。

## Goals / Non-Goals

**Goals:**

- 新增 Candidate storage repo，使用 `CandidateSchema` / `parse_candidate` 读写 JSON。
- Candidate 保存到 `knowledge/candidates/YYYY/MM/<candidate_id>.json`。
- 支持按 id 读取 Candidate。
- 支持 Candidate list，默认按 `collected_at desc` 排序。
- 支持按 `status` 过滤 Candidate list。
- 新增只读 workflow summary，供 CLI 展示。
- 新增 `ai-knowledge candidate list` / `candidate show`，并支持 `--json`。
- 验证 Candidate 不写入 `knowledge/index/`，answer 不检索 Candidate。

**Non-Goals:**

- 不实现 collector。
- 不实现 Candidate score 计算、去重、推荐阈值或重评分。
- 不实现 Candidate 状态流转或 `candidate select`。
- 不创建 Source，不更新 `converted_source_id`。
- 不实现 Candidate 编辑、删除或归档。

## Decisions

### Decision 1: Candidate path 由 storage path helper 统一生成

新增 `candidate_dir` / `candidate_json_path` 等 path helper，基于 Candidate id 中的日期片段定位 `knowledge/candidates/YYYY/MM/<candidate_id>.json`。

Rationale: 项目规则要求不要在 workflow/CLI 手写 `knowledge/` 路径；Source/Note/Index 已采用 helper 模式。

Alternative considered: 在 candidate repo 内直接拼路径。实现更少，但会违反 storage path 分层规则。

### Decision 2: Candidate repo 负责 schema parse 与持久化

新增 `create_candidate`、`get_candidate`、`list_candidates`。写入和读取都通过 `parse_candidate`，确保落盘对象符合 domain invariants。

Rationale: Candidate JSON 是候选池对象真相，storage 层必须防止无效 Candidate 进入文件系统。

Alternative considered: 只在 collector 产生 Candidate 时校验。后续手动写文件或迁移读取时仍可能引入无效对象，因此不采用。

### Decision 3: list/show workflow 只读，不改变 Candidate 状态

`list_candidates_workflow` 和 `show_candidate_workflow` 只读取和 summarise Candidate，不做状态变更、不创建 Source、不写 index。

Rationale: Issue 19 范围是“存储与只读查看”。状态流转与转 Source 属于后续 Issue。

Alternative considered: 同时支持推荐/选中状态操作。该方案会跨入 Candidate workflow，范围过大。

### Decision 4: CLI 输出 summary，JSON 输出 workflow result

普通输出展示 id、status、title、source_type、score、collected_at、url 等查看字段；`--json` 返回 workflow result，便于自动化测试和脚本使用。

Rationale: 与现有 Source/Note CLI 模式一致，保持人类可读与机器可读两个通道。

Alternative considered: 普通输出直接打印完整 JSON。信息完整但不够易读，且和现有 CLI 风格不一致。

## Risks / Trade-offs

- [Risk] 还没有 collector，Candidate repo 只能由测试或未来代码写入。→ Mitigation: 本变更是后续 collector 的前置；测试会直接调用 repo 覆盖写入路径。
- [Risk] list 扫描所有 Candidate 文件，未来数量大时性能有限。→ Mitigation: 本地 MVP/P2 初期接受全量扫描；后续需要再引入缓存或索引。
- [Risk] Candidate show/list 被误认为能进入问答。→ Mitigation: spec 和测试明确不写 main index，answer 仍只查 approved Notes。

## Migration Plan

1. 在 storage path helper 中新增 Candidate 路径函数。
2. 新增 `src/storage/candidate-repo.ts`。
3. 新增 Candidate summary 与 list/show workflows。
4. 在 CLI 中新增 `candidate` 命令组及 `list`/`show`。
5. 添加 storage、workflow、CLI 测试。
6. 验证 answer/index 不受 Candidate 影响。

Rollback strategy: 该变更只新增 Candidate storage/read-only 文件与 CLI 命令；回滚时删除新增模块和命令接入即可，不迁移现有 Source/Note/Index 数据。

## Open Questions

- 是否需要 `candidate list --source-type`？本变更先只做 issue 明确要求的 `--status`，source_type 过滤留后续视使用需求添加。
- 是否要提供 create/import CLI？当前不提供，避免绕过 collector/recommendation 设计；测试通过 repo 直接创建 fixture。

## Verification Strategy

- `openspec validate "candidate-storage-readonly-view" --strict`
- Candidate storage tests。
- Candidate workflow tests。
- Candidate CLI tests。
- Existing answer/index tests to confirm isolation。
- Full `pnpm test`、`pnpm typecheck`、`pnpm lint`、`pnpm format:check`、`pnpm build`。
