## ADDED Requirements

### Requirement: Note Supersede Creates Draft Version

The system SHALL allow users to create a new draft Note version that supersedes an existing approved Note through an explicit supersede workflow. The workflow MUST require an `approved_for_note` Source as the source of the new version's confirmed conclusions, and MUST NOT create a new approved Note directly.

#### Scenario: Supersede creates draft version
- **WHEN** the user requests to supersede an approved Note using a Source with status `approved_for_note`
- **THEN** the workflow creates a new Note with status `draft`
- **AND** the new Note uses `version = old.version + 1`
- **AND** the new Note uses the same `root_note_id` as the old Note
- **AND** the new Note sets `supersedes_note_id = old.id`
- **AND** the new Note sets `superseded_by_note_id = null`
- **AND** the new Note still requires `note lint`, `note approve`, and `note index` before entering main knowledge retrieval

#### Scenario: Supersede rejects non-approved old Note
- **WHEN** the user requests to supersede a Note whose status is not `approved`
- **THEN** the workflow rejects the operation
- **AND** no new Note version is created
- **AND** the old Note remains unchanged

#### Scenario: Supersede rejects unapproved Source
- **WHEN** the user requests to supersede an approved Note using a Source whose status is not `approved_for_note`
- **THEN** the workflow rejects the operation
- **AND** no new Note version is created
- **AND** the old Note remains `approved`

### Requirement: Supersede Marks Old Note Noncurrent

The system SHALL mark the superseded old Note as noncurrent after the new draft version is created. The old Note MUST transition through the domain state-machine helper to `superseded` and MUST record the new Note id in `superseded_by_note_id`.

#### Scenario: Old Note is marked superseded
- **WHEN** supersede workflow successfully creates the new draft Note version
- **THEN** the old Note transitions from `approved` to `superseded` through the state-machine helper
- **AND** the old Note sets `superseded_by_note_id = new.id`
- **AND** the old Note preserves `note.json` and `note.md` for historical traceability

#### Scenario: Old Note update fails after new Note creation
- **WHEN** the workflow creates the new draft Note but fails to update the old Note
- **THEN** the workflow returns `PARTIAL_FAILURE`
- **AND** does not hide the created new Note
- **AND** reports that the old Note still requires manual resolution

### Requirement: Note Version Chain Is Inspectable

The system SHALL expose Note version-chain fields in Note summaries and show output so users can inspect current and historical relationships.

#### Scenario: User shows a superseded Note
- **WHEN** the user runs `ai-knowledge note show <note_id>` for a superseded Note
- **THEN** the output includes `version`, `root_note_id`, `supersedes_note_id`, and `superseded_by_note_id`
- **AND** the command does not print full `note.md` by default

#### Scenario: User shows a new draft version
- **WHEN** the user runs `ai-knowledge note show <note_id>` for the new draft version
- **THEN** the output includes `version`, `root_note_id`, `supersedes_note_id`, and `superseded_by_note_id`
- **AND** the output shows `status = draft`

### Requirement: Note Supersede Supports JSON Output

The system SHALL support machine-readable output for Note supersede.

#### Scenario: User requests JSON output for Note supersede
- **WHEN** the user runs the Note supersede command with `--json`
- **THEN** the CLI returns a JSON representation of the workflow result
- **AND** the JSON includes the old Note summary, new Note summary, and new Note id
