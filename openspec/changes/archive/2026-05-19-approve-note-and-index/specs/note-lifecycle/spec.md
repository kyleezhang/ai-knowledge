## MODIFIED Requirements

### Requirement: Note Approval Requires QA
The system SHALL approve a `Note` only after required QA or lint checks pass. `note approve` MUST only accept draft Notes whose `quality_checks.status = passed`.

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

#### Scenario: Note approve succeeds
- **WHEN** `ai-knowledge note approve <note_id>` runs for a draft Note with `quality_checks.status = passed`
- **THEN** the workflow transitions the Note to `approved`
- **AND** sets `approved_at`
- **AND** returns next action `ai-knowledge note index <note_id>`

#### Scenario: Note approve without passed quality checks
- **WHEN** `ai-knowledge note approve <note_id>` runs for a draft Note whose quality checks have not passed
- **THEN** the workflow rejects approval
- **AND** the Note remains `draft`
