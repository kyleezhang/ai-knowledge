## ADDED Requirements

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
