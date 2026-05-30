## ADDED Requirements

### Requirement: Index Related Note Ids Come From Approved Note JSON

The system SHALL derive `IndexEntry.related_note_ids` only from the approved `note.json` being indexed. The indexing workflow MUST NOT discover, infer, or add related Note ids during indexing.

#### Scenario: Note with confirmed related ids is indexed
- **WHEN** an approved Note with `related_note_ids` is indexed
- **THEN** the Index Entry includes the same `related_note_ids`
- **AND** indexing does not add any extra related Note ids

#### Scenario: Note has no confirmed related ids
- **WHEN** an approved Note has `related_note_ids = []`
- **THEN** the Index Entry also has `related_note_ids = []`
