## MODIFIED Requirements

### Requirement: Index Entry Is Retrieval Pointer
The system SHALL treat an index entry as retrieval metadata, not knowledge truth. Answer workflows MUST use index entries only to locate approved `note.json` records. When an index entry includes `vector_ref`, the vector reference MUST also be treated only as retrieval metadata for locating approved Notes. Hybrid retrieval MAY use Index Entry fields for filtering and scoring, but MUST NOT treat those fields as formal answer evidence.

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

#### Scenario: Hybrid retrieval scores index metadata
- **WHEN** hybrid retrieval uses `title`, `summary`, `keywords`, `tags`, `approved_at`, or `related_note_ids` from an Index Entry
- **THEN** those fields affect candidate filtering or ranking only
- **AND** the answer workflow still loads approved `note.json` for evidence

### Requirement: Index Entry References Note
The system SHALL include enough metadata in each index entry to trace back to the note. P0 index entries MUST include `note_id`, `title`, `summary`, `keywords`, `tags`, `status = approved`, `approved_at`, `related_note_ids`, and `vector_ref = null`. In P3, successful vector indexing MAY set `vector_ref` to a storage-helper-resolved vector index reference for the same approved Note. Hybrid retrieval MAY use these fields for filtering, boosting, and traceable ranking explanations.

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

#### Scenario: Hybrid retrieval explains metadata match
- **WHEN** an Index Entry matches a metadata filter or boost
- **THEN** hybrid retrieval can include the matched metadata field in its explanation
- **AND** the Index Entry remains a retrieval pointer only
