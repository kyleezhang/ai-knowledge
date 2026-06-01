## ADDED Requirements

### Requirement: Note Archive Preserves Formal Knowledge Files

The system SHALL allow users to archive a Note through `ai-knowledge note archive <note_id>` without deleting or rewriting `note.json` or `note.md`. Note archive MUST use the domain state-machine helper and MUST preserve the Note for traceability.

#### Scenario: Approved Note archive succeeds
- **WHEN** the user runs `ai-knowledge note archive <note_id>` for an approved Note
- **THEN** the workflow transitions the Note to `archived` through the state-machine helper
- **AND** updates `updated_at`
- **AND** preserves `note.json`
- **AND** preserves `note.md`

#### Scenario: Draft Note archive succeeds
- **WHEN** the user runs `ai-knowledge note archive <note_id>` for a draft Note
- **THEN** the workflow transitions the Note to `archived` through the state-machine helper
- **AND** updates `updated_at`
- **AND** preserves `note.json` and `note.md`

#### Scenario: Note archive rejects non-archivable Note
- **WHEN** the user runs `ai-knowledge note archive <note_id>` for a Note whose status is `archived` or `superseded`
- **THEN** the workflow rejects the operation as invalid state
- **AND** leaves the Note unchanged

### Requirement: Archived Notes Remain Inspectable But Noncurrent

The system SHALL preserve archived Notes for historical inspection while excluding them from the current main knowledge layer.

#### Scenario: User shows archived Note
- **WHEN** the user runs `ai-knowledge note show <note_id>` for an archived Note
- **THEN** the system displays the Note control summary including `status = archived`
- **AND** does not default to printing the full `note.md`
- **AND** does not modify the Note

#### Scenario: User filters archived Notes
- **WHEN** the user runs `ai-knowledge note list --status archived`
- **THEN** the system lists Notes whose `status` is `archived`
- **AND** omits Notes in other statuses

### Requirement: Note Archive Supports JSON Output

The system SHALL support machine-readable output for Note archive.

#### Scenario: User requests JSON output for Note archive
- **WHEN** the user runs `ai-knowledge note archive <note_id> --json`
- **THEN** the CLI returns a JSON representation of the archive workflow result
- **AND** the JSON includes the archived Note summary
