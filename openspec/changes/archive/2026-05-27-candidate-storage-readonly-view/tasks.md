## 1. Storage paths and repository

- [x] 1.1 在 `src/storage/paths.ts` 新增 Candidate path helper，生成 `knowledge/candidates/YYYY/MM/<candidate_id>.json`。
- [x] 1.2 新增 `src/storage/candidate-repo.ts`，实现 `create_candidate`、`get_candidate`、`list_candidates`。
- [x] 1.3 Candidate repo 读写 JSON 时通过 `parse_candidate` 校验，并处理 not found / invalid path / already exists 等 storage errors。
- [x] 1.4 `list_candidates` 默认按 `collected_at desc` 排序，并支持 `status` 过滤。

## 2. Workflows and summaries

- [x] 2.1 新增 Candidate summary 类型与 summarizer，包含 id、status、source_type、title、score、collected_at、url、converted_source_id 等展示字段。
- [x] 2.2 新增 `list_candidates_workflow`，调用 repo 并返回 summaries。
- [x] 2.3 新增 `show_candidate_workflow`，按 id 返回 Candidate summary/detail，并处理 not found。
- [x] 2.4 确认 list/show workflow 只读，不修改 Candidate、不创建 Source/Note/Index。

## 3. CLI

- [x] 3.1 在 CLI 中新增 `candidate` command group。
- [x] 3.2 实现 `ai-knowledge candidate list` 普通输出与 `--json` 输出。
- [x] 3.3 实现 `ai-knowledge candidate list --status <status>` 并校验 status enum。
- [x] 3.4 实现 `ai-knowledge candidate show <candidate_id>` 普通输出与 `--json` 输出。
- [x] 3.5 确认 Candidate CLI 不提供 create/edit/select/convert 命令。

## 4. Tests

- [x] 4.1 新增 Candidate path helper / repo tests，覆盖保存路径、读取、列表排序、status 过滤、schema parse。
- [x] 4.2 新增 Candidate workflow tests，覆盖 list/show/not found/read-only 行为。
- [x] 4.3 新增 Candidate CLI tests，覆盖 list/show/status filter/json/error 输出。
- [x] 4.4 增加隔离测试，确认保存 Candidate 不创建 index entry，answer 不直接检索 Candidate。

## 5. 验证

- [x] 5.1 运行 OpenSpec validation，确认 `candidate-storage-readonly-view` 的 proposal、design、specs、tasks 均有效。
- [x] 5.2 运行 targeted Candidate storage/workflow/CLI tests。
- [x] 5.3 运行完整 `pnpm test`。
- [x] 5.4 运行 `pnpm typecheck`。
- [x] 5.5 运行 `pnpm lint` 与 `pnpm format:check`。
- [x] 5.6 运行 `pnpm build`。
