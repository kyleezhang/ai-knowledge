## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Markdown Import Preserves Source Layout

The system SHALL create the P0 Source filesystem layout when importing Markdown.

#### Scenario: Markdown Source is persisted after import
- **WHEN** Markdown import succeeds
- **THEN** the Source control data is stored in `source.json`
- **AND** an empty `discussion.jsonl` exists for future discussion messages
- **AND** the original Markdown content is copied to `raw/original.md`
- **AND** a `processed/` directory exists for future processing artifacts
- **AND** `processing_artifacts` remains empty until the processing workflow runs

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

#### Scenario: User requests JSON output for Source list or show
- **WHEN** the user runs `ai-knowledge source list --json` or `ai-knowledge source show <source_id> --json`
- **THEN** the system outputs the corresponding Source workflow data as JSON
- **AND** the command does not change Source workflow state
