## MODIFIED Requirements

### Requirement: Index Entry Is Retrieval Pointer
The system SHALL treat an index entry as retrieval metadata, not knowledge truth. Answer workflows MUST use index entries only to locate approved `note.json` records.

#### Scenario: Index entry is read
- **WHEN** the answer workflow retrieves an index entry
- **THEN** it uses the entry to locate the approved `Note`
- **AND** treats `note.json` as the authoritative knowledge source

#### Scenario: Index entry points to missing note
- **WHEN** an index entry points to a missing or unloadable Note
- **THEN** the answer workflow skips that entry
- **AND** does not treat index metadata as knowledge truth

### Requirement: Reindexing Does Not Mutate Notes
The system SHALL allow rebuilding index entries without changing formal note content.

#### Scenario: Index is rebuilt
- **WHEN** the indexer regenerates entries
- **THEN** it may update index files
- **AND** it does not modify `note.json` or `note.md`

#### Scenario: Answer retrieval reads index
- **WHEN** answer retrieval reads index entries
- **THEN** it does not modify index files or notes
