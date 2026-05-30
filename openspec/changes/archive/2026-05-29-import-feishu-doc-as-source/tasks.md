## 1. Domain Contract

- [x] 1.1 扩展 Source domain schema，加入 `ingest_type = feishu_doc` 与 `origin.user_input_type = feishu_doc`，保持核心字段 snake_case。
- [x] 1.2 定义飞书来源 metadata 的 Zod 校验契约，覆盖 original input、title、document type、imported timestamp 等可追溯字段。
- [x] 1.3 更新 Source 相关 domain 测试，验证 Feishu Doc Source 的合法字段、非法枚举值拒绝和状态初始值。

## 2. Storage And Artifacts

- [x] 2.1 通过现有 storage path helpers 增加保存 Feishu raw snapshot 与 `raw/original.md` 的能力，不手写 `knowledge/` 路径。
- [x] 2.2 确保 Feishu Doc Source 创建时写入 `source.json`、空 `discussion.jsonl`、`raw/` artifacts 和 `processed/` 目录，且 `processing_artifacts` 为空。
- [x] 2.3 增加 storage 测试，验证 raw snapshot、Markdown snapshot、相对 artifact 路径和失败时不产生半成品 Source。

## 3. Feishu Import Adapter And Workflow

- [x] 3.1 增加可 mock 的 Feishu Doc reader adapter，输入 URL/token，输出 title、document type、Markdown body 和 raw snapshot，不在 repo 中保存凭据。
- [x] 3.2 实现 `importFeishuDocAsSource` workflow：读取飞书文档、校验正文、创建 `status = ingested` Source，并返回 next action `ai-knowledge source process <source_id>`。
- [x] 3.3 处理认证失败、权限不足、文档不存在、正文为空和转换失败，确保这些失败不创建 `Source`、`Note` 或 `Index Entry`。
- [x] 3.4 增加 workflow 测试，使用 fake adapter 覆盖成功导入、失败边界、metadata、raw artifact 和 workflow gate 不被跳过。

## 4. Processing Integration

- [x] 4.1 更新 Source processing 分派逻辑，使 Feishu Doc Source 使用 `raw/original.md` 作为处理输入，并禁止 processing 阶段重新读取远端飞书文档。
- [x] 4.2 确保 Feishu Doc processing 产出 `processed/clean_text.md`、`processed/segments.json`、`processed/metadata.json`，并使用一致的 processed segment locator。
- [x] 4.3 增加 processing 测试，验证 snapshot 存在时成功处理、snapshot 缺失时记录 `last_error.stage = processing`，以及状态转换走 domain state machine。

## 5. CLI Integration

- [x] 5.1 增加 `ai-knowledge source ingest feishu-doc <doc_url_or_token>` 子命令，复用 source ingest 命令结构和错误输出风格。
- [x] 5.2 支持 `--json` 输出，包含 created Source identifier、Source summary 和 next action。
- [x] 5.3 增加 CLI 测试，覆盖普通输出、JSON 输出、缺少参数和 adapter 失败提示。

## 6. Verification

- [x] 6.1 运行 OpenSpec status/validation，确认 `import-feishu-doc-as-source` 的 proposal、design、specs、tasks 均完成且可应用。
- [x] 6.2 运行项目 typecheck、lint、format check、build 和 Vitest 测试套件。
- [x] 6.3 做一次 mock 或本地替身的端到端演练：Feishu Doc 导入为 Source 后必须先 process，不能直接 understand 或 compose Note。
