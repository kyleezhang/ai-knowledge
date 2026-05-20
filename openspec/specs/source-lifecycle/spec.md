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
The system SHALL expose `ai-knowledge source approve <source_id>` to move a converged and explicitly confirmed Source from `discussing` to `approved_for_note`.

#### Scenario: Source approval succeeds
- **WHEN** a Source has status `discussing`
- **AND** `discussion_summary.ready_for_approval = true`
- **AND** `discussion_summary.confirmed_points` is non-empty
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

