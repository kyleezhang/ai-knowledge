## MODIFIED Requirements

### Requirement: Answers Prefer Approved Notes
The system SHALL prefer approved notes as the primary evidence source for answers. P0 answer workflow MUST use only approved Notes loaded through approved Index Entries. When P3 hybrid retrieval is explicitly enabled, answer workflow MUST still use hybrid results only to locate approved Notes and MUST ground answers in the loaded `note.json` records.

#### Scenario: Approved notes match question
- **WHEN** the user asks a question and approved notes match it
- **THEN** the answer is grounded primarily in those notes
- **AND** the response identifies the relevant notes or references

#### Scenario: No approved notes match question
- **WHEN** the user asks a question and no approved index entry matches it
- **THEN** the system states that there is no related confirmed knowledge
- **AND** does not call raw Source fallback as if it were approved knowledge

#### Scenario: Hybrid retrieval matches approved notes
- **WHEN** hybrid retrieval returns approved Note candidates
- **THEN** the answer workflow loads those approved Notes from `note.json`
- **AND** grounds the answer in those Notes rather than retrieval metadata

### Requirement: Retrieval Uses Main Index As Entry Point
The system SHALL use the main index as the entry point for approved-note retrieval in P0 and P3 hybrid retrieval. P0 retrieval searches keyword and metadata index entries. When hybrid retrieval is explicitly enabled, retrieval MAY also use vector references reachable from approved Index Entries.

#### Scenario: User asks a question
- **WHEN** the answer workflow begins retrieval
- **THEN** it searches keyword and metadata index entries
- **AND** loads approved notes referenced by matching entries

#### Scenario: Top-k retrieval is requested
- **WHEN** the user passes `--top-k <n>`
- **THEN** the answer workflow returns at most that many matching approved Notes to the Answer Agent

#### Scenario: Hybrid retrieval is enabled
- **WHEN** answer workflow runs in hybrid retrieval mode
- **THEN** retrieval combines keyword, metadata, and available vector signals from approved Index Entries
- **AND** still returns at most the requested top-k approved Notes to the Answer Agent

### Requirement: Answer Evidence Remains Traceable
The system SHALL keep answer evidence traceable to approved Notes. When approved Notes contain processed segment evidence locators, answer traceability MUST remain rooted in those approved Notes and MUST NOT require answer workflow to load raw Sources, draft understanding, or discussion-stage material. Hybrid retrieval explanations MAY be returned for debugging, but MUST NOT replace approved Note evidence.

#### Scenario: Answer is produced
- **WHEN** the system returns an answer
- **THEN** it includes references to the note objects used as evidence
- **AND** distinguishes approved notes from unavailable unapproved material

#### Scenario: Approved note contains segment locators
- **WHEN** an approved Note used for answering contains `source_refs[].evidence_refs` in the form `processed/segments.json#<segment_id>`
- **THEN** the answer workflow may preserve or display those refs as part of note traceability
- **AND** it does not treat the referenced Source, raw material, draft understanding, or discussion summary as additional answer evidence

#### Scenario: Hybrid retrieval explanation is available
- **WHEN** answer workflow returns keyword, metadata, or vector score explanations
- **THEN** those explanations are presented only as retrieval diagnostics
- **AND** answer claims remain grounded in approved Note JSON
