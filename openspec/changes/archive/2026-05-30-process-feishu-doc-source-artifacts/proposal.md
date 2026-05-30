## Why

飞书文档已经可以作为用户显式导入的 `Source`，但后续处理阶段需要把该 Source 稳定地产出为标准 `processed/clean_text.md`、`processed/segments.json` 和 `processed/metadata.json`，否则无法安全进入 draft understanding。当前主规格中也出现了飞书处理相关 requirement 标题重复前缀的问题，需要借此变更收敛为清晰、可验证的 processing 契约。

本变更属于 P1 范围：只处理已经导入并冻结到本地的单个 Feishu Doc Source，不重新读取远端飞书文档，不扩展同步、扫描或批量导入能力。

## What Changes

- 明确 Feishu Doc Source 的 processing 输入：`ai-knowledge source process <source_id>` MUST 只读取本地 `raw/original.md`。
- 明确 Feishu Doc Source 的 processing 输出：必须写入标准三件套 `processed/clean_text.md`、`processed/segments.json`、`processed/metadata.json`，并登记到 `source.processing_artifacts`。
- 明确 Feishu Doc segment locator：使用统一 processed locator contract，`locator.ref` 指向 `processed/segments.json#<segment_id>`，`locator.source_kind = feishu_doc`。
- 明确失败行为：缺失 `raw/original.md` 或正文无法规范化时，处理失败并记录 `last_error.stage = processing`，保留 `raw/feishu-doc.json` 等 raw artifacts。
- 修正主规格中飞书处理 requirement 标题重复 `### Requirement:` 的格式问题。
- 非目标：不新增飞书导入命令、不重新设计 Feishu reader、不处理附件/OCR/评论、不做知识库批量同步、不引入数据库、Web UI、向量检索或远端刷新能力。

## Capabilities

### New Capabilities

### Modified Capabilities

- `source-processing`: 收敛并强化 Feishu Doc Source 处理契约，确保其生成标准 processed artifacts、稳定 segment locator，并修正已有 requirement 标题格式。

## Impact

- Affected layers: processing, storage artifact schema, workflows, CLI tests, workflow tests, OpenSpec specs。
- Processing: Feishu Doc Source 复用本地 Markdown snapshot 处理，但输出 locator 明确标记为 `feishu_doc`。
- Storage: processed segment locator schema 需要接受 `source_kind = feishu_doc`。
- Workflow: `process_source_workflow` 必须通过 Source state machine 完成 `ingested -> processing -> processed`，失败时进入 `failed` 并记录 processing error。
- CLI: `source process <source_id>` 对 Feishu Doc Source 的输出应与其他 Source 一致，不新增命令。
- Tests: 增加/补齐 Feishu Doc Source processing 成功、缺失 snapshot 失败、artifact schema、CLI process JSON/human output 的验证。
