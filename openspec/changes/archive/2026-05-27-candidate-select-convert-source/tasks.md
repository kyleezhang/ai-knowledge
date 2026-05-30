## 1. Source support for Candidate origin

- [x] 1.1 确认/补充 Source domain invariant 支持 `ingest_type = candidate_selected`、`origin.type = candidate`、`origin_candidate_id`。
- [x] 1.2 新增 Candidate-to-Source raw Markdown builder，保留 title、summary、url、tags、source_type。
- [x] 1.3 添加 Source domain/storage tests，覆盖 Candidate-created Source 的字段和 raw artifact。

## 2. Candidate select workflow

- [x] 2.1 新增 `select_candidate_workflow`，读取 Candidate 并校验 `status = recommended`。
- [x] 2.2 workflow 将 Candidate 更新为 `selected`，创建 Source 后更新为 `converted`。
- [x] 2.3 workflow 使用 `create_source_id` 生成唯一 Source id，并创建 `Source.status = ingested`。
- [x] 2.4 workflow 写入 Source origin/candidate 双向引用和 Candidate `converted_source_id`。
- [x] 2.5 workflow 返回 next action `ai-knowledge source process <source_id>`。
- [x] 2.6 workflow 拒绝 missing、non-recommended、already converted Candidate。

## 3. CLI

- [x] 3.1 新增 `ai-knowledge candidate select <candidate_id>` 命令。
- [x] 3.2 select 命令支持 `--json` 输出。
- [x] 3.3 普通输出展示创建的 Source summary、Candidate id 与 next action。

## 4. Tests

- [x] 4.1 添加 Candidate select workflow 成功转换测试。
- [x] 4.2 覆盖 non-recommended、missing、重复转换失败。
- [x] 4.3 覆盖 Candidate 状态 `recommended -> selected -> converted` 与 `converted_source_id`。
- [x] 4.4 覆盖 Source 字段：`candidate_selected`、`origin.type = candidate`、`origin_candidate_id`、raw markdown stub。
- [x] 4.5 添加 CLI tests，覆盖 select、`--json`、错误输出、next action。
- [x] 4.6 验证转换不创建 processed artifacts、draft understanding、Note 或 Index。

## 5. Verification

- [x] 5.1 运行 OpenSpec validation，确认 `candidate-select-convert-source` 的 proposal、design、specs、tasks 均有效。
- [x] 5.2 运行 targeted Candidate select workflow/CLI tests。
- [x] 5.3 运行完整 `pnpm test`。
- [x] 5.4 运行 `pnpm typecheck`。
- [x] 5.5 运行 `pnpm lint` 与 `pnpm format:check`。
- [x] 5.6 运行 `pnpm build`。
