# Source Lifecycle Specification

## Purpose

This capability defines how a `Source` enters and moves through the learning workflow. A `Source` is the main working object for imported learning material before it becomes approved knowledge.
## Requirements
### Requirement: Markdown Import Creates Source

The system SHALL create a `Source` when a user imports a Markdown file in P0 through `ai-knowledge source ingest markdown <file>`.

#### Scenario: User imports Markdown
- **WHEN** the user imports a valid Markdown file
- **THEN** the system creates a `Source` with status `ingested`
- **AND** records the import as user-originated material
- **AND** persists `ingest_type = upload_markdown`
- **AND** persists `content_type = document`
- **AND** persists `origin.type = user_import`
- **AND** stores raw material without rewriting its contents to hide processing errors
- **AND** returns the created `source_id` and next action to process the Source

### Requirement: Markdown Import Preserves Source Layout

The system SHALL create the P0 Source filesystem layout when importing Markdown.

#### Scenario: Markdown Source is persisted after import
- **WHEN** Markdown import succeeds
- **THEN** the Source control data is stored in `source.json`
- **AND** an empty `discussion.jsonl` exists for future discussion messages
- **AND** the original Markdown content is copied to `raw/original.md`
- **AND** a `processed/` directory exists for future processing artifacts
- **AND** `processing_artifacts` remains empty until the processing workflow runs

### Requirement: Candidate Selection Creates Source
系统 SHALL allow selected recommended Candidates to create Sources through an explicit user action. Candidate-created Sources MUST use `ingest_type = candidate_selected`, `origin.type = candidate`, and MUST start at `ingested` status.

#### Scenario: Candidate Source is created
- **WHEN** Candidate select workflow creates a Source from a Candidate
- **THEN** Source status MUST be `ingested`
- **AND** Source ingest_type MUST be `candidate_selected`
- **AND** Source content_type MUST be `link`
- **AND** Source origin.type MUST be `candidate`
- **AND** Source origin.candidate_id MUST equal the Candidate id
- **AND** Source origin_candidate_id MUST equal the Candidate id

#### Scenario: Candidate Source preserves raw material
- **WHEN** Candidate select workflow creates a Source
- **THEN** Source raw artifact MUST preserve Candidate title、summary、url、tags and source_type in a processable Markdown file
- **AND** processing_artifacts MUST remain empty until source process runs

### Requirement: Source List Shows Workflow Queue

The system SHALL allow users to list imported Sources without changing their workflow state.

#### Scenario: User lists Sources
- **WHEN** the user runs `ai-knowledge source list`
- **THEN** the system displays Sources ordered by `updated_at` descending
- **AND** each listed Source includes at least `id`, `status`, `title`, and `updated_at`
- **AND** no Source status or knowledge artifact is modified

#### Scenario: User filters Sources by status
- **WHEN** the user runs `ai-knowledge source list --status ingested`
- **THEN** the system displays only Sources whose `status` is `ingested`
- **AND** Sources in other statuses are omitted

### Requirement: Source Show Displays Control Summary

The system SHALL allow users to inspect a single Source control summary without treating it as approved knowledge.

#### Scenario: User shows an existing Source
- **WHEN** the user runs `ai-knowledge source show <source_id>` for an existing Source
- **THEN** the system displays at least `title`, `status`, `ingest_type`, `content_type`, `processing_artifacts`, `discussion_summary` status, and `note_ids`
- **AND** it displays `draft_understanding.summary` only when `draft_understanding` exists
- **AND** it does not default to printing the complete raw or processed artifact body
- **AND** no Source status or knowledge artifact is modified

#### Scenario: User shows a missing Source
- **WHEN** the user runs `ai-knowledge source show <source_id>` for a missing Source
- **THEN** the system reports that the Source was not found
- **AND** no new Source, Note, or Index Entry is created

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

#### Scenario: User requests JSON output for Source list or show
- **WHEN** the user runs `ai-knowledge source list --json` or `ai-knowledge source show <source_id> --json`
- **THEN** the system outputs the corresponding Source workflow data as JSON
- **AND** the command does not change Source workflow state

### Requirement: PDF Import Creates Source

系统 SHALL 在 P1 中通过 `ai-knowledge source ingest pdf <file>` 为用户导入的 PDF 创建 `Source`。

#### Scenario: User imports PDF
- **WHEN** 用户导入一个有效的 PDF 文件
- **THEN** 系统创建 `status = ingested` 的 `Source`
- **AND** persists `ingest_type = upload_pdf`
- **AND** persists `content_type = document`
- **AND** persists `origin.type = user_import`
- **AND** persists `origin.user_input_type = pdf`
- **AND** copies the raw file to `raw/original.pdf`
- **AND** an empty `discussion.jsonl` exists for future discussion messages
- **AND** a `processed/` directory exists for future processing artifacts
- **AND** `processing_artifacts` remains empty until the processing workflow runs
- **AND** returns the created `source_id` and next action to process the Source

#### Scenario: PDF file cannot be read
- **WHEN** 用户导入的 PDF 文件不存在、不可读或不是有效输入文件
- **THEN** 系统拒绝该导入请求
- **AND** does not create a new `Source`, `Note`, or `Index Entry`

### Requirement: URL Import Creates Source From Explicit Public Input

系统 SHALL 在 P1 中通过 `ai-knowledge source ingest url <public_url>` 为用户显式提供的 public URL 创建 `Source`，且只有在成功抓取稳定 raw snapshot 后才进入既有 Source 生命周期。

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

#### Scenario: URL import exceeds public single-page scope
- **WHEN** 用户提供的 URL 需要登录、cookie、session、权限令牌，或需要 crawling、site discovery、search expansion 才能获取正文
- **THEN** 系统拒绝该导入请求
- **AND** does not create a new `Source`, `Note`, or `Index Entry`

### Requirement: Source Uses Schema Fields

The system SHALL persist `Source` objects using the fields and filesystem layout defined by the schema baseline.

#### Scenario: Source is persisted
- **WHEN** a `Source` is saved
- **THEN** its control data is stored in `source.json`
- **AND** discussion messages are stored separately in `discussion.jsonl`
- **AND** raw and processed artifacts are kept under the `raw/` and `processed/` directories

### Requirement: Source State Transitions Are Explicit

The system SHALL change `Source.status` only through domain state-machine helpers.

#### Scenario: Workflow advances source status
- **WHEN** a workflow needs to move a `Source` to another status
- **THEN** it requests the transition through the state-machine helper
- **AND** invalid transitions are rejected before persistence

### Requirement: Source Cannot Skip Processing

The system SHALL NOT allow a `Source` to move from `ingested` directly to `understanding_ready`.

#### Scenario: Draft understanding requested too early
- **WHEN** a `Source` has no processed artifacts
- **THEN** the system rejects generation of `draft_understanding`
- **AND** the `Source` does not become `understanding_ready`

### Requirement: Candidate Conversion Is Outside P0

The system SHALL treat automatic candidate conversion as outside P0 unless a later OpenSpec change brings it into scope.

#### Scenario: Candidate conversion is requested in P0
- **WHEN** a workflow attempts to convert a `Candidate` into a `Source` without an accepted scope-expansion change
- **THEN** the capability is considered unsupported in P0
- **AND** no main knowledge object is created from the candidate

### Requirement: Source Approval Advances To Note Readiness
The system SHALL expose `ai-knowledge source approve <source_id>` to move a converged and explicitly confirmed Source from `discussing` to `approved_for_note`. Approval MUST use the deterministic discussion convergence checker and MUST reject approval when the checker fails.

#### Scenario: Source approval succeeds
- **WHEN** a Source has status `discussing`
- **AND** `discussion_summary.ready_for_approval = true`
- **AND** `discussion_summary.confirmed_points` is non-empty
- **AND** `discussion_summary.open_questions` is empty
- **AND** `discussion_summary.unresolved_issues` is empty
- **AND** the deterministic discussion convergence checker passes
- **THEN** the workflow transitions the Source to `approved_for_note`
- **AND** sets `discussion_summary.discussion_status = closed`
- **AND** returns next action `ai-knowledge note compose <source_id>`

#### Scenario: Source is not discussing
- **WHEN** `ai-knowledge source approve <source_id>` is run for a Source whose status is not `discussing`
- **THEN** the workflow rejects the operation
- **AND** leaves the existing Source status unchanged

#### Scenario: Source approval JSON output is requested
- **WHEN** the user runs `ai-knowledge source approve <source_id> --json`
- **THEN** the CLI returns a JSON representation of the workflow result
- **AND** the JSON includes the approved Source summary and next action

#### Scenario: Convergence checker rejects approval
- **WHEN** `ai-knowledge source approve <source_id>` is run for a Source whose discussion summary does not pass the deterministic convergence checker
- **THEN** the workflow rejects the operation
- **AND** the error includes at least one convergence failure reason
- **AND** leaves the existing Source status unchanged

### Requirement: Source Records Composed Notes
The system SHALL record Note ids on the Source after successful Note composition.

#### Scenario: Note compose updates Source
- **WHEN** a Note is composed from a Source with status `approved_for_note`
- **THEN** the Source records the composed Note id in `note_ids`
- **AND** the Source transitions to `noted`

#### Scenario: Note compose is requested after Source is already noted
- **WHEN** note composition is requested for a Source whose status is `noted`
- **THEN** P0 rejects the operation
- **AND** does not create an additional parallel main Note

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

### Requirement: Source Archive Preserves Source Artifacts

The system SHALL allow users to archive a Source through `ai-knowledge source archive <source_id>` without deleting or rewriting any raw material, processed artifacts, discussion messages, or source control data. Source archive MUST use the domain state-machine helper and MUST leave associated Notes unchanged.

#### Scenario: Source archive succeeds
- **WHEN** the user runs `ai-knowledge source archive <source_id>` for an existing Source whose status is not `processing` and not `archived`
- **THEN** the workflow transitions the Source to `archived` through the state-machine helper
- **AND** updates `updated_at`
- **AND** preserves `source.json`, `discussion.jsonl`, `raw/`, and `processed/`
- **AND** does not archive or mutate any Note referenced by `Source.note_ids`

#### Scenario: Source archive rejects active processing
- **WHEN** the user runs `ai-knowledge source archive <source_id>` for a Source whose status is `processing`
- **THEN** the workflow rejects the operation
- **AND** leaves the Source status unchanged
- **AND** does not delete any Source files

#### Scenario: Source archive rejects already archived Source
- **WHEN** the user runs `ai-knowledge source archive <source_id>` for a Source whose status is already `archived`
- **THEN** the workflow rejects the operation as invalid state
- **AND** leaves the Source unchanged

### Requirement: Archived Sources Remain Inspectable

The system SHALL allow archived Sources to be listed and shown for historical traceability.

#### Scenario: User shows archived Source
- **WHEN** the user runs `ai-knowledge source show <source_id>` for an archived Source
- **THEN** the system displays the Source control summary including `status = archived`
- **AND** does not print full raw or processed artifact bodies by default
- **AND** does not modify the Source

#### Scenario: User filters archived Sources
- **WHEN** the user runs `ai-knowledge source list --status archived`
- **THEN** the system lists Sources whose `status` is `archived`
- **AND** omits Sources in other statuses

### Requirement: Source Archive Supports JSON Output

The system SHALL support machine-readable output for Source archive.

#### Scenario: User requests JSON output for Source archive
- **WHEN** the user runs `ai-knowledge source archive <source_id> --json`
- **THEN** the CLI returns a JSON representation of the archive workflow result
- **AND** the JSON includes the archived Source summary
