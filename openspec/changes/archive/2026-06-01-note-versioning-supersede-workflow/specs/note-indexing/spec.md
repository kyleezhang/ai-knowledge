## ADDED Requirements

### Requirement: Superseded Notes Are Removed From Main Retrieval

The system SHALL ensure that superseded Notes do not appear in main answer retrieval results. When an approved Note is superseded, the workflow MUST remove the old Note's main Index Entry or otherwise make it unavailable to main retrieval without deleting the old Note's formal knowledge files.

#### Scenario: Supersede removes old index entry
- **WHEN** an approved Note with an existing main Index Entry is superseded
- **THEN** the supersede workflow removes the old Note's corresponding Index Entry from main retrieval
- **AND** the old Note status becomes `superseded`
- **AND** later answer retrieval does not return the old Note

#### Scenario: New draft version is not indexed automatically
- **WHEN** supersede workflow creates the new draft Note version
- **THEN** no main Index Entry is created for the new Note
- **AND** the new Note must pass approval before `note index` can create an Index Entry

#### Scenario: Superseded Note is not indexed
- **WHEN** the user runs `ai-knowledge note index <note_id>` for a superseded Note
- **THEN** the system rejects main indexing
- **AND** does not create a main Index Entry

### Requirement: Supersede Index Cleanup Uses Storage Helpers

The system SHALL clean up supersede-related Index Entry files through storage helpers rather than hand-building `knowledge/` paths in workflows or CLI code.

#### Scenario: Supersede workflow removes old index entry
- **WHEN** supersede workflow removes the old Note Index Entry
- **THEN** the index path is resolved by storage helpers
- **AND** workflow code does not hand-build `knowledge/index/` paths
