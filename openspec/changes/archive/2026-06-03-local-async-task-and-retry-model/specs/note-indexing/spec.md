## ADDED Requirements

### Requirement: Note Indexing May Run As Local Task
The system SHALL allow Note indexing to be enqueued and run as a local task. The runner MUST call the existing Note indexing workflow and preserve approved-only indexing gates.

#### Scenario: Approved Note indexing task runs
- **WHEN** a `note.index` task is executed for an approved Note
- **THEN** the runner calls the Note indexing workflow
- **AND** may create or update the main Index Entry

#### Scenario: Draft Note indexing task runs
- **WHEN** a `note.index` task targets a draft Note
- **THEN** the task attempt records a non-retryable failure
- **AND** no main Index Entry is created
