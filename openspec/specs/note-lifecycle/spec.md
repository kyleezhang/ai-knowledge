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
The system SHALL check the minimum required `note.json` fields before a Note can pass lint. In addition to required semantic fields, lint MUST validate that `source_refs[].evidence_refs` are non-empty processed segment locators in the form `processed/segments.json#<segment_id>` and MUST reject raw material paths or artifact-level refs that do not identify a segment.

#### Scenario: Required fields are present
- **WHEN** a draft Note contains non-empty `source_refs`, `conclusions`, `why_it_matters`, `approval_context.source_id`, and positive `approval_context.approved_from_summary_version`
- **AND** each `source_refs[].evidence_refs` value is a valid processed segment locator
- **THEN** those required-field checks pass

#### Scenario: Required fields are missing
- **WHEN** a draft Note has empty `source_refs`, `conclusions`, `why_it_matters`, missing `approval_context.source_id`, or invalid `approved_from_summary_version`
- **THEN** lint fails
- **AND** reports the missing or invalid field

#### Scenario: Evidence ref points to raw material
- **WHEN** a draft Note has `source_refs[].evidence_refs` containing a raw path such as `raw/original.pdf#page=1` or `raw/original.html#intro`
- **THEN** lint fails
- **AND** reports that formal Note evidence refs must reference processed segments

#### Scenario: Evidence ref omits segment anchor
- **WHEN** a draft Note has `source_refs[].evidence_refs` containing `processed/segments.json`, `processed/clean_text.md`, or `processed/metadata.json`
- **THEN** lint fails
- **AND** reports that the evidence ref must use `processed/segments.json#<segment_id>`

### Requirement: Note Composition Uses Allowed Evidence Locators
The system SHALL provide Note Agent with evidence refs derived from processed segments and SHALL reject Note candidate output that references locators outside that allowed set.

#### Scenario: Note candidate uses allowed locator
- **WHEN** `note compose` runs for an approved Source with processed segments
- **AND** the Note Agent returns `source_refs[].evidence_refs` that are all present in the processed segment locator set
- **THEN** the workflow may accept the candidate after all other Note validation passes

#### Scenario: Note candidate invents locator
- **WHEN** the Note Agent returns `source_refs[].evidence_refs` containing a locator not present in the processed segment locator set
- **THEN** the workflow rejects the candidate
- **AND** does not silently rewrite the locator
- **AND** does not create a formal Note from that candidate

#### Scenario: Note composition prepares source refs
- **WHEN** `note compose` prepares source refs for an approved Source
- **THEN** it derives evidence refs from `processed/segments.json` segment locators
- **AND** it does not expose `processed/clean_text.md` or `processed/metadata.json` as formal evidence refs

### Requirement: Note Lint Supports JSON Output
The system SHALL support machine-readable output for Note lint.

#### Scenario: User requests JSON output for lint
- **WHEN** the user runs `ai-knowledge note lint <note_id> --json`
- **THEN** the CLI returns the lint workflow result as JSON
- **AND** includes pass/fail status and failure reasons

### Requirement: Note Composition Uses Only Confirmed Related Notes

The system SHALL allow related notes to be provided to note composition only after confirmation. The note-composition workflow MUST NOT write any `related_note_ids` that were introduced solely by the Note Agent output without prior confirmation.

#### Scenario: Confirmed related notes are written
- **WHEN** note composition receives confirmed related Note ids
- **AND** each confirmed Note id references an approved Note
- **THEN** the composed Note may include those ids in `related_note_ids`

#### Scenario: Agent suggests unconfirmed related notes
- **WHEN** Note Agent output includes `related_note_ids` not present in the confirmed related Note input
- **THEN** the workflow rejects or filters those unconfirmed ids before persisting `note.json`
- **AND** no unconfirmed relationship becomes part of formal knowledge

#### Scenario: No related notes are confirmed
- **WHEN** note composition receives no confirmed related Note ids
- **THEN** the composed Note uses `related_note_ids = []`

### Requirement: Related Notes Are Passed As Compose Context

The system SHALL pass confirmed related notes as context to the Note Agent during composition, while preserving the rule that only confirmed related Note ids can be persisted.

#### Scenario: Compose receives related note context
- **WHEN** confirmed related notes are available before note composition
- **THEN** the Note Agent input includes those related note summaries
- **AND** the workflow validates persisted `related_note_ids` against the confirmed set

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
