## MODIFIED Requirements

### Requirement: Hybrid Retrieval Results Are Retrieval Metadata
The system SHALL treat hybrid retrieval results as retrieval metadata. Results MUST locate approved Notes and MUST NOT become formal knowledge truth or answer evidence by themselves. Direct hybrid results MAY trigger one-hop related Note expansion through confirmed `related_note_ids`, but that expansion metadata remains retrieval metadata.

#### Scenario: Hybrid result is passed to answer workflow
- **WHEN** answer workflow receives hybrid retrieval results
- **THEN** it loads approved `note.json` records for the result `note_id`s
- **AND** passes approved Notes, not retrieval metadata, to the Answer Agent

#### Scenario: Hybrid result expands related notes
- **WHEN** a direct hybrid result points to an approved Note with confirmed `related_note_ids`
- **THEN** answer workflow may load those related approved Notes as supplementary context
- **AND** the related expansion result identifies the direct result that caused it

#### Scenario: Hybrid explanation contains chunk text
- **WHEN** a retrieval explanation includes vector chunk context for debugging
- **THEN** that context is not treated as answer evidence
- **AND** answer generation remains grounded in approved Note JSON

### Requirement: Hybrid Retrieval Uses Approved Main Index As Candidate Boundary
The system SHALL start hybrid retrieval from approved main Index Entries. Hybrid retrieval MUST NOT return draft, archived, superseded, missing, or unloadable Notes. Configured embedding provider usage and related expansion MUST NOT expand the candidate boundary beyond approved main Index Entries and current approved Notes.

#### Scenario: Approved index entry is matched
- **WHEN** an approved Index Entry matches hybrid retrieval
- **THEN** the workflow may load the corresponding approved `note.json`
- **AND** include it as a candidate result

#### Scenario: Related expansion target is not approved
- **WHEN** a direct hybrid result has a `related_note_ids` target whose Note is not currently approved
- **THEN** hybrid answer expansion skips that target
- **AND** does not return it through direct, related, keyword, metadata, or vector signals

#### Scenario: Indexed Note is no longer approved
- **WHEN** a matching Index Entry points to a Note whose status is not `approved`
- **THEN** hybrid retrieval skips that Note
- **AND** does not return it through keyword, metadata, or vector signals
