## 1. Spec Hygiene

- [x] 1.1 修正 `openspec/specs/source-processing/spec.md` 中 Feishu requirement 标题重复 `### Requirement:` 的格式问题。
- [x] 1.2 确保 `process-feishu-doc-source-artifacts` 的 delta spec 能在 archive 时完整覆盖 Feishu processing requirement。

## 2. Processing Contract

- [x] 2.1 确认 processed segment schema 接受 `locator.source_kind = feishu_doc`，且不影响 `markdown`、`pdf`、`url`。
- [x] 2.2 确认 Feishu Doc Source processing 只读取本地 `raw/original.md`，不调用 Feishu reader 或远端 API。
- [x] 2.3 确认 Feishu Doc Source processing 成功后登记标准 `processing_artifacts` 三件套。
- [x] 2.4 确认 Feishu Doc Source processing 缺失 `raw/original.md` 时进入 `failed` 并记录 `last_error.stage = processing`。

## 3. Tests

- [x] 3.1 增加或补齐 workflow 测试，覆盖 Feishu Doc Source import -> process -> processed artifacts。
- [x] 3.2 增加或补齐 workflow 测试，覆盖 Feishu Doc Source 缺失 Markdown snapshot 的 processing failure。
- [x] 3.3 增加或补齐 CLI 测试，覆盖 `source process <source_id>` 对 Feishu Doc Source 的 human-readable 和 JSON 输出。

## 4. Verification

- [x] 4.1 运行 `openspec validate process-feishu-doc-source-artifacts --strict`。
- [x] 4.2 运行 focused Vitest tests 覆盖 Source workflow、Source CLI 和 storage artifact schema。
- [x] 4.3 运行 `pnpm typecheck`、`pnpm lint`、`pnpm format:check`、`pnpm build` 和 `pnpm test`。
