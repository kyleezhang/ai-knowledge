## ADDED Requirements

### Requirement: Feishu Doc Import Creates Source

系统 SHALL 通过 `ai-knowledge source ingest feishu-doc <doc_url_or_token>` 为用户显式指定的单个飞书文档创建 `Source`，且只有在文档内容成功读取并保存为本地 raw artifact 后才创建 Source。

#### Scenario: User imports readable Feishu Doc
- **WHEN** 用户提供一个当前身份有权限读取的飞书文档 URL 或 token
- **AND** 系统成功读取文档标题和正文
- **THEN** 系统创建 `status = ingested` 的 `Source`
- **AND** persists `ingest_type = feishu_doc`
- **AND** persists `content_type = document`
- **AND** persists `origin.type = user_import`
- **AND** persists `origin.user_input_type = feishu_doc`
- **AND** persists Feishu source metadata including original input, title, document type, and imported timestamp
- **AND** returns the created `source_id` and next action to process the Source

#### Scenario: Feishu Doc cannot be read
- **WHEN** 飞书文档不存在、权限不足、认证失效，或读取结果不包含可处理正文
- **THEN** 系统拒绝该导入请求
- **AND** does not create a new `Source`, `Note`, or `Index Entry`

### Requirement: Feishu Doc Import Preserves Raw And Normalized Artifacts

系统 SHALL 在导入飞书文档时保留可回溯 raw artifact，并生成后续 Source processing 可消费的 Markdown 正文 artifact；导入阶段 MUST NOT 把内容直接写入 `draft_understanding`、`Note` 或 `Index Entry`。

#### Scenario: Feishu Doc artifacts are persisted after import
- **WHEN** 飞书文档导入成功
- **THEN** the Source control data is stored in `source.json`
- **AND** an empty `discussion.jsonl` exists for future discussion messages
- **AND** the retrieved raw Feishu document payload or lossless export snapshot is stored under `raw/`
- **AND** normalized Markdown body is stored as `raw/original.md`
- **AND** a `processed/` directory exists for future processing artifacts
- **AND** `processing_artifacts` remains empty until the processing workflow runs

### Requirement: Feishu Doc Import Is Explicit Single-Document Input

系统 SHALL 仅支持用户显式指定的单个飞书文档导入，不得在该能力中扩展为知识库批量同步、空间遍历、链接发现或自动采集。

#### Scenario: User requests broader Feishu synchronization
- **WHEN** 用户请求导入整个飞书知识库、文件夹、空间，或要求自动发现相关文档
- **THEN** 系统拒绝该请求作为 `feishu-doc` 单文档导入
- **AND** no `Source`, `Candidate`, `Note`, or `Index Entry` is created by the rejected request

### Requirement: Feishu Doc Import Supports JSON Output

系统 SHALL 为飞书文档导入命令支持 machine-readable JSON 输出。

#### Scenario: User requests JSON output for Feishu Doc import
- **WHEN** 用户运行 `ai-knowledge source ingest feishu-doc <doc_url_or_token> --json`
- **THEN** 系统 outputs the workflow result data as JSON
- **AND** the JSON includes the created Source identifier
- **AND** the JSON includes the next action command `ai-knowledge source process <source_id>`
