# Note Lifecycle Specification

## Purpose

This capability defines how formal knowledge notes are composed, approved, archived, and related back to their source material.
## Requirements
### Requirement: Note Composition Requires Approved Source
The system SHALL compose a formal `Note` only from a `Source` with status `approved_for_note`. P0 note composition MUST use the approved Source's `discussion_summary.confirmed_points` as the only source for `conclusions`.

#### Scenario: Approved source composes note
- **WHEN** a `Source` has status `approved_for_note`
- **THEN** the note-composition workflow may create a `Note`
- **AND** the `Source` may record the new `note_id`

#### Scenario: Unapproved source composes note
- **WHEN** a `Source` is not `approved_for_note`
- **THEN** the system rejects formal note composition
- **AND** no `note.json` or `note.md` is created

#### Scenario: Note candidate adds unconfirmed conclusion
- **WHEN** Note Agent output includes a conclusion not present in `discussion_summary.confirmed_points`
- **THEN** the workflow rejects the candidate
- **AND** no formal Note is created from that candidate

### Requirement: Note JSON Is Created Before Markdown
The system SHALL create `note.json` as the formal knowledge source of truth before rendering `note.md`. The workflow MUST supplement Note Agent output with system-controlled fields including id, slug, status, version, timestamps, approval_context, render_metadata, and quality_checks.

#### Scenario: Note is composed
- **WHEN** note composition succeeds
- **THEN** the system persists validated `note.json`
- **AND** only then renders `note.md` from `note.json`

#### Scenario: Workflow supplements Note system fields
- **WHEN** Note Agent returns valid semantic candidate fields
- **THEN** the workflow adds Note id, slug, draft status, version, timestamps, approval_context, render_metadata, and quality_checks
- **AND** the model does not control those fields

### Requirement: New Notes Start As Draft
The system SHALL create newly composed notes with status `draft` and default quality checks that do not mark the note as approved.

#### Scenario: New note is saved
- **WHEN** a `Note` is first composed
- **THEN** its status is `draft`
- **AND** it is not eligible for main indexing until approval

#### Scenario: New note quality checks are initialized
- **WHEN** a `Note` is first composed
- **THEN** `quality_checks.status` is not `passed`
- **AND** the note requires later lint or QA before approval

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

### Requirement: Noncurrent Notes Are Preserved But Not Primary

The system SHALL preserve `archived` and `superseded` notes while excluding them from the current main knowledge layer.

#### Scenario: Note is archived or superseded
- **WHEN** a `Note` transitions to `archived` or `superseded`
- **THEN** it remains stored for traceability
- **AND** it is not treated as the current approved note for indexing or answer grounding

### Requirement: Note Agent Uses Compose Prompt
The system SHALL use `compose-note-json.md` when generating a Note candidate from an approved Source.

#### Scenario: Note Agent is called
- **WHEN** `ai-knowledge note compose <source_id>` runs for an approved Source
- **THEN** the workflow calls Note Agent
- **AND** the Agent uses `src/agents/prompts/compose-note-json.md`

### Requirement: Source Is Linked To Composed Note
The system SHALL link a composed Note back to its Source and advance the Source lifecycle.

#### Scenario: Source is updated after Note creation
- **WHEN** Note creation succeeds
- **THEN** the workflow appends the Note id to `Source.note_ids`
- **AND** transitions Source from `approved_for_note` to `noted`

#### Scenario: Source update fails after Note creation
- **WHEN** `note.json` and `note.md` are created but Source update fails
- **THEN** the workflow returns `PARTIAL_FAILURE`
- **AND** does not hide the created Note

### Requirement: Notes Can Be Listed And Shown
The system SHALL support read-only Note list and show commands for created Notes.

#### Scenario: User lists notes
- **WHEN** the user runs `ai-knowledge note list`
- **THEN** the system displays Note id, status, title, and updated_at ordered by updated_at descending

#### Scenario: User filters notes by status
- **WHEN** the user runs `ai-knowledge note list --status draft`
- **THEN** the system lists only Notes with that status

#### Scenario: User shows note summary
- **WHEN** the user runs `ai-knowledge note show <note_id>`
- **THEN** the system displays title, status, conclusions, source_refs, related_note_ids, and quality_checks
- **AND** does not default to printing the full `note.md`

#### Scenario: User requests JSON output
- **WHEN** the user runs `note compose`, `note list`, or `note show` with `--json`
- **THEN** the CLI returns the corresponding workflow result as JSON

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

