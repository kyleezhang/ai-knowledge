## ADDED Requirements

### Requirement: Source Records Composed Notes
The system SHALL record Note ids on the Source after successful Note composition.

#### Scenario: Note compose updates Source
- **WHEN** a Note is composed from a Source with status `approved_for_note`
- **THEN** the Source records the composed Note id in `note_ids`
- **AND** the Source transitions to `noted`

#### Scenario: Note compose is requested after Source is already noted
- **WHEN** note composition is requested for a Source whose status is `noted`
- **THEN** P0 rejects the operation
- **AND** does not create an additional parallel main Note
