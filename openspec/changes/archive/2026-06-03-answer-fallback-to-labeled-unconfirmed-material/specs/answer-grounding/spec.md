## MODIFIED Requirements

### Requirement: Answers Prefer Approved Notes
The system SHALL prefer approved notes as the primary evidence source for answers. P0 answer workflow MUST use only approved Notes loaded through approved Index Entries. When P3 hybrid retrieval is explicitly enabled, answer workflow MUST still use hybrid results only to locate approved Notes and MUST ground answers in the loaded `note.json` records. When unconfirmed fallback is explicitly enabled, approved Notes remain primary evidence and unconfirmed materials may only be used as labeled secondary evidence.

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

#### Scenario: Fallback is explicitly enabled
- **WHEN** no approved Notes sufficiently answer the question and fallback is explicitly enabled
- **THEN** the answer may include unconfirmed materials as secondary evidence
- **AND** approved Notes remain primary evidence whenever available

### Requirement: Unapproved Material Is Secondary Evidence
The system SHALL NOT use raw sources, draft understanding, or discussion summaries as secondary evidence in P0 answer workflow. When fallback is explicitly enabled, the system MAY use structured unconfirmed materials as secondary evidence, but MUST label them as unconfirmed and MUST NOT use raw artifacts.

#### Scenario: Approved notes are insufficient
- **WHEN** approved notes do not sufficiently answer the question
- **THEN** the P0 system reports limitations
- **AND** does not consult raw sources or discussion-stage material

#### Scenario: Explicit fallback uses structured material
- **WHEN** fallback is explicitly enabled and structured unconfirmed materials match the question
- **THEN** the system may use those materials as secondary evidence
- **AND** labels them as unconfirmed

#### Scenario: Raw source exists
- **WHEN** only raw Source material matches the question
- **THEN** the answer workflow does not use that raw material as fallback evidence

### Requirement: Answers Do Not Invent Unsupported Claims
The system SHALL avoid fabricating conclusions when available knowledge is insufficient. Claims based on fallback evidence MUST be phrased as unconfirmed and MUST include limitations.

#### Scenario: Retrieval has insufficient evidence
- **WHEN** neither approved notes nor clearly marked secondary evidence support an answer
- **THEN** the system states that the current knowledge base is insufficient
- **AND** does not present unsupported claims as settled knowledge

#### Scenario: Answer Agent receives approved notes
- **WHEN** the Answer Agent is called in P0
- **THEN** it receives approved Notes as evidence
- **AND** it must not use model background knowledge as project knowledge

#### Scenario: Answer Agent receives unconfirmed materials
- **WHEN** the Answer Agent is called with fallback materials
- **THEN** it must keep claims from those materials explicitly unconfirmed
- **AND** must not present them as approved knowledge

### Requirement: Answer Evidence Remains Traceable
The system SHALL keep answer evidence traceable to approved Notes. When approved Notes contain processed segment evidence locators, answer traceability MUST remain rooted in those approved Notes and MUST NOT require answer workflow to load raw Sources, draft understanding, or discussion-stage material. Hybrid retrieval explanations MAY be returned for debugging, but MUST NOT replace approved Note evidence. Fallback evidence MUST be traceable to Source ids and structured material references.

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

#### Scenario: Fallback evidence is used
- **WHEN** answer workflow includes fallback evidence
- **THEN** each fallback item includes a Source trace reference
- **AND** the answer distinguishes it from approved Note evidence
