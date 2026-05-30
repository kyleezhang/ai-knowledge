## Why

当前主动导入入口覆盖本地 Markdown，但用户的学习材料也经常沉淀在飞书文档中；如果需要先手工导出再导入，会打断学习资料进入 Source 工作流的闭环。

本变更属于 P1 范围：新增“显式指定飞书文档并导入为 Source”的能力，继续保持 `Source` 作为主动学习资料入口，不绕过处理、理解、讨论和确认 gates。

## What Changes

- 新增 CLI 命令：`ai-knowledge source ingest feishu-doc <doc_url_or_token>`，从用户显式指定的飞书文档读取内容并创建 `Source`。
- 新增飞书文档获取与 Markdown 化处理边界：导入结果保存为 raw artifact，并将可处理正文作为 Source processing 的输入。
- Source metadata 记录飞书文档来源信息，包括原始 URL/token、标题、文档类型和导入时间。
- 飞书文档导入后仍必须走 `source process -> understand -> discuss -> approve`，不得直接生成正式 Note。
- 非目标：不做飞书知识库批量同步、不做自动扫描或自动采集、不做 PDF/附件导入、不做 Web UI、不引入数据库或向量检索。

## Capabilities

### New Capabilities

- `feishu-doc-ingestion`: 显式读取单个飞书文档并导入为本地 `Source` 的能力，包括 CLI 入口、来源元数据、raw artifact 保存和错误边界。

### Modified Capabilities

- `source-lifecycle`: 主动导入来源新增飞书文档类型，并要求其创建的 `Source` 遵循既有 Source 状态机与学习闭环。
- `source-processing`: Source processing 需要接受飞书文档导入产生的 Markdown 正文 artifact 作为处理输入。

## Impact

- Affected layers: domain, storage, processing, workflows, CLI, tests。
- CLI: 增加 `source ingest feishu-doc` 子命令与错误提示。
- Domain: 扩展 Source 输入类型与元数据 schema，保持 snake_case 字段。
- Storage: 通过现有 path helpers 保存 raw 飞书文档 artifact 和规范化 Markdown artifact，不手写 `knowledge/` 路径。
- Processing/workflows: 增加飞书文档导入 workflow，并复用现有 Source processing gates。
- External system: 依赖已认证的飞书文档读取能力；认证失败、权限不足或文档不可读时必须失败，不创建半成品 Source。
- Tests: 覆盖 metadata 校验、存储路径、导入 workflow、CLI 参数和后续 processing 兼容性。
