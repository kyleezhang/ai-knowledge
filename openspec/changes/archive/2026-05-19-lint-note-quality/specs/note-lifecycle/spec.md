## MODIFIED Requirements

### Requirement: Note Approval Requires QA
The system SHALL approve a `Note` only after required QA or lint checks pass. P0 lint MUST run only for `draft` Notes and MUST write the result to `quality_checks`.

#### Scenario: Draft note passes QA
- **WHEN** a `draft` Note passes required QA checks
- **THEN** it may transition to `approved`
- **AND** it becomes eligible for main indexing

#### Scenario: Draft note fails QA
- **WHEN** a `draft` Note fails required QA checks
- **THEN** it remains unapproved
- **AND** the system reports the blocking issues

#### Scenario: Draft note lint succeeds
- **WHEN** `ai-knowledge note lint <note_id>` runs for a valid `draft` Note and all checks pass
- **THEN** the workflow writes `quality_checks.status = passed`
- **AND** returns next action `ai-knowledge note approve <note_id>`

#### Scenario: Draft note lint fails
- **WHEN** `ai-knowledge note lint <note_id>` runs and any required check fails
- **THEN** the workflow writes `quality_checks.status = failed`
- **AND** returns the failure reasons
- **AND** the Note remains `draft`

#### Scenario: Non-draft note lint is requested
- **WHEN** `ai-knowledge note lint <note_id>` runs for a Note whose status is not `draft`
- **THEN** the workflow rejects the operation
- **AND** does not update `quality_checks`

## ADDED Requirements

### Requirement: Note Lint Checks Required Knowledge Fields
The system SHALL check the minimum required `note.json` fields before a Note can pass lint.

#### Scenario: Required fields are present
- **WHEN** a draft Note contains non-empty `source_refs`, `conclusions`, `why_it_matters`, `approval_context.source_id`, and positive `approval_context.approved_from_summary_version`
- **THEN** those required-field checks pass

#### Scenario: Required fields are missing
- **WHEN** a draft Note has empty `source_refs`, `conclusions`, `why_it_matters`, missing `approval_context.source_id`, or invalid `approved_from_summary_version`
- **THEN** lint fails
- **AND** reports the missing or invalid field

### Requirement: Note Lint Supports JSON Output
The system SHALL support machine-readable output for Note lint.

#### Scenario: User requests JSON output for lint
- **WHEN** the user runs `ai-knowledge note lint <note_id> --json`
- **THEN** the CLI returns the lint workflow result as JSON
- **AND** includes pass/fail status and failure reasons
