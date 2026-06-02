## MODIFIED Requirements

### Requirement: Only Approved Notes Enter Main Index
The system SHALL create main index entries only for notes with status `approved`. P0 `note index` MUST reject draft, archived, and superseded Notes. In P3, vector index entries are part of main retrieval indexing and MUST follow the same approved-only gate.

#### Scenario: Approved note is indexed
- **WHEN** a `Note` has status `approved`
- **THEN** the system may build a main index entry for it

#### Scenario: Draft note is indexed
- **WHEN** a `Note` has status `draft`
- **THEN** the system rejects main indexing
- **AND** no main index entry is created

#### Scenario: Archived or superseded note is indexed
- **WHEN** a `Note` has status `archived` or `superseded`
- **THEN** the system rejects main indexing
- **AND** preserves the note without treating it as current knowledge

#### Scenario: Draft note is vector indexed
- **WHEN** vector indexing is requested for a `Note` with status `draft`
- **THEN** the system rejects vector indexing
- **AND** no main vector index entry is created

### Requirement: Index Entry Is Retrieval Pointer
The system SHALL treat an index entry as retrieval metadata, not knowledge truth. Answer workflows MUST use index entries only to locate approved `note.json` records. When an index entry includes `vector_ref`, the vector reference MUST also be treated only as retrieval metadata for locating approved Notes.

#### Scenario: Index entry is read
- **WHEN** the answer workflow retrieves an index entry
- **THEN** it uses the entry to locate the approved `Note`
- **AND** treats `note.json` as the authoritative knowledge source

#### Scenario: Index entry points to missing note
- **WHEN** an index entry points to a missing or unloadable Note
- **THEN** the answer workflow skips that entry
- **AND** does not treat index metadata as knowledge truth

#### Scenario: Vector reference is read
- **WHEN** the answer workflow follows `vector_ref` from an index entry
- **THEN** it uses vector metadata only to locate candidate approved Notes
- **AND** does not treat embedding text or vector metadata as knowledge truth

### Requirement: Index Entry References Note
The system SHALL include enough metadata in each index entry to trace back to the note. P0 index entries MUST include `note_id`, `title`, `summary`, `keywords`, `tags`, `status = approved`, `approved_at`, `related_note_ids`, and `vector_ref = null`. In P3, successful vector indexing MAY set `vector_ref` to a storage-helper-resolved vector index reference for the same approved Note.

#### Scenario: Index entry is created
- **WHEN** a note is indexed
- **THEN** the entry includes `note_id`, title or summary metadata, tags or keywords when available, and the path or reference needed to load the note

#### Scenario: P0 index entry is created
- **WHEN** `ai-knowledge note index <note_id>` succeeds for an approved Note without vector indexing
- **THEN** the index entry status is `approved`
- **AND** `vector_ref` is `null`

#### Scenario: P3 vector index entry is created
- **WHEN** vector indexing succeeds for an approved Note
- **THEN** the main Index Entry may include a non-null `vector_ref`
- **AND** `vector_ref` points to vector retrieval metadata for the same `note_id`
