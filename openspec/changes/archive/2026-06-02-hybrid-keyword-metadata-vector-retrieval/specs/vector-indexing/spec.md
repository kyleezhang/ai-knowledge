## MODIFIED Requirements

### Requirement: Vector Index Entry Is Retrieval Metadata
The system SHALL treat vector index entries as retrieval metadata, not knowledge truth. Answer workflows using vector retrieval MUST use vector hits only to locate approved `note.json` records. Hybrid retrieval MAY use vector similarity as one ranking signal, but MUST NOT pass vector chunk text as answer evidence.

#### Scenario: Vector hit is returned
- **WHEN** vector retrieval returns a chunk hit
- **THEN** the answer workflow loads the corresponding approved `Note`
- **AND** treats `note.json` as the authoritative knowledge source

#### Scenario: Vector hit points to missing note
- **WHEN** a vector hit points to a missing or unloadable Note
- **THEN** the answer workflow skips that hit
- **AND** does not answer from vector metadata alone

#### Scenario: Vector hit contributes to hybrid score
- **WHEN** hybrid retrieval uses vector similarity for a candidate
- **THEN** the vector hit contributes only to retrieval ranking
- **AND** the answer workflow still grounds output in approved Note JSON

### Requirement: Archived And Superseded Notes Are Removed From Vector Retrieval
The system SHALL ensure archived and superseded Notes do not appear in main vector retrieval results. When a Note is archived or superseded, any corresponding vector index MUST be removed or made unavailable to main retrieval. Hybrid retrieval MUST also exclude archived and superseded Notes from vector-derived candidates.

#### Scenario: Approved note with vector index is archived
- **WHEN** an approved Note with a vector index is archived
- **THEN** the archive workflow makes the vector index unavailable to main retrieval
- **AND** later vector retrieval does not return that Note

#### Scenario: Approved note with vector index is superseded
- **WHEN** an approved Note with a vector index is superseded
- **THEN** the supersede workflow makes the old vector index unavailable to main retrieval
- **AND** later vector retrieval does not return the old Note

#### Scenario: Supersede creates new draft version
- **WHEN** supersede workflow creates a new draft Note version
- **THEN** no vector index is created for the draft Note
- **AND** the new Note must be approved before vector indexing can succeed

#### Scenario: Hybrid retrieval sees stale vector data
- **WHEN** hybrid retrieval encounters vector data for an archived or superseded Note
- **THEN** it excludes that vector hit from main results
- **AND** does not use it to rank or answer from the stale Note
