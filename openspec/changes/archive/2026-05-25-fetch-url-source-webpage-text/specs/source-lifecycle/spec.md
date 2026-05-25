## MODIFIED Requirements

### Requirement: Source Commands Support JSON Output
The system SHALL support machine-readable output for non-interactive Source commands.

#### Scenario: User requests JSON output for Source import
- **WHEN** the user runs `ai-knowledge source ingest markdown <file> --json`
- **THEN** the system outputs the workflow result data as JSON
- **AND** the JSON includes the created Source identifier

#### Scenario: User requests JSON output for PDF or URL import
- **WHEN** the user runs `ai-knowledge source ingest pdf <file> --json` or `ai-knowledge source ingest url <public_url> --json`
- **THEN** the system outputs the workflow result data as JSON
- **AND** the JSON includes the created Source identifier
- **AND** for URL import, the JSON includes a Source summary with `ingest_type = input_url`, `content_type = link`, and the next action to process the Source

#### Scenario: User requests JSON output for Source list or show
- **WHEN** the user runs `ai-knowledge source list --json` or `ai-knowledge source show <source_id> --json`
- **THEN** the system outputs the corresponding Source workflow data as JSON
- **AND** the command does not change Source workflow state

### Requirement: URL Import Creates Source From Explicit Public Input
系统 SHALL 在 P1 中通过 `ai-knowledge source ingest url <public_url>` 为用户显式提供的 public URL 创建 `Source`，且只有在成功抓取稳定 raw snapshot 后才进入既有 Source 生命周期。系统 MUST NOT create a Source for URLs that require authentication, private/internal network access, crawling, site discovery, search expansion, or non-HTML content.

#### Scenario: User imports public URL
- **WHEN** 用户导入一个可公开访问的单页 URL，且系统成功抓取页面快照
- **THEN** 系统创建 `status = ingested` 的 `Source`
- **AND** persists `ingest_type = input_url`
- **AND** persists `content_type = link`
- **AND** persists `origin.type = user_import`
- **AND** persists `origin.user_input_type = url`
- **AND** persists `url` as the requested source URL
- **AND** stores the fetched page snapshot in `raw/fetched.html`
- **AND** an empty `discussion.jsonl` exists for future discussion messages
- **AND** a `processed/` directory exists for future processing artifacts
- **AND** `processing_artifacts` remains empty until the processing workflow runs
- **AND** returns the created `source_id` and next action to process the Source

#### Scenario: URL import follows public redirect to HTML
- **WHEN** 用户导入一个 public HTTP(S) URL，且该 URL 重定向到仍然 public 的 HTML 页面
- **THEN** 系统可保存最终返回的 HTML snapshot in `raw/fetched.html`
- **AND** persists `url` as the originally requested source URL
- **AND** does not create a `Note` or `Index Entry`

#### Scenario: URL import exceeds public single-page scope
- **WHEN** 用户提供的 URL 需要登录、cookie、session、权限令牌，或需要 crawling、site discovery、search expansion 才能获取正文
- **THEN** 系统拒绝该导入请求
- **AND** does not create a new `Source`, `Note`, or `Index Entry`

#### Scenario: URL import is not supported public HTML
- **WHEN** 用户提供的 URL 不是 absolute HTTP(S) URL、指向 localhost/private/internal network、抓取失败、返回非 HTML 内容，或返回空 HTML
- **THEN** 系统拒绝该导入请求
- **AND** does not create a new `Source`, `Note`, or `Index Entry`
