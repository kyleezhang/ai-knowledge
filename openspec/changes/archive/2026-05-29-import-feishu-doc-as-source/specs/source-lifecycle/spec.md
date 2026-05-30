## ADDED Requirements

### Requirement: Feishu Doc Import Enters Source Lifecycle

系统 SHALL 将成功导入的飞书文档作为用户主动提供资料进入既有 Source 生命周期，并保持后续处理、理解、讨论、确认、Note 生成和索引 gates 不变。

#### Scenario: Feishu Doc Source is created
- **WHEN** Feishu Doc import workflow creates a Source from a readable Feishu document
- **THEN** Source status MUST be `ingested`
- **AND** Source ingest_type MUST be `feishu_doc`
- **AND** Source content_type MUST be `document`
- **AND** Source origin.type MUST be `user_import`
- **AND** Source origin.user_input_type MUST be `feishu_doc`
- **AND** Source processing_artifacts MUST remain empty until source process runs

#### Scenario: Feishu Doc Source cannot skip workflow gates
- **WHEN** a Feishu Doc Source has only been imported and has not completed processing, understanding, discussion convergence, and explicit source approval
- **THEN** the system MUST NOT create a formal `Note`
- **AND** the system MUST NOT create a main `Index Entry`
