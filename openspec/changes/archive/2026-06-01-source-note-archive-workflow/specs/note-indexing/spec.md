## ADDED Requirements

### Requirement: Archived Notes Are Removed From Main Retrieval

The system SHALL ensure that archived Notes do not appear in main answer retrieval results. When an approved Note is archived, the workflow MUST remove the corresponding main Index Entry or otherwise make it unavailable to main retrieval without modifying `note.json` semantic content.

#### Scenario: Approved Note archive removes index entry
- **WHEN** an approved Note with an existing main Index Entry is archived
- **THEN** the archive workflow removes the corresponding Index Entry from main retrieval
- **AND** the Note status becomes `archived`
- **AND** later answer retrieval does not return that Note

#### Scenario: Draft Note archive has no index entry
- **WHEN** a draft Note without a main Index Entry is archived
- **THEN** the archive workflow succeeds without requiring an Index Entry
- **AND** no new Index Entry is created

#### Scenario: Archived Note is not indexed
- **WHEN** the user runs `ai-knowledge note index <note_id>` for an archived Note
- **THEN** the system rejects main indexing
- **AND** does not create a main Index Entry

### Requirement: Index Cleanup Uses Storage Helpers

The system SHALL clean up archive-related Index Entry files through storage helpers rather than hand-building `knowledge/` paths in workflows or CLI code.

#### Scenario: Archive workflow removes index entry
- **WHEN** Note archive workflow removes an Index Entry
- **THEN** the index path is resolved by storage helpers
- **AND** workflow code does not hand-build `knowledge/index/` paths
