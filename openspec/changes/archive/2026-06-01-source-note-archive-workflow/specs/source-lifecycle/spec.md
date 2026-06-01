## ADDED Requirements

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
