## MODIFIED Requirements

### Requirement: Answer Evidence Remains Traceable
The system SHALL keep answer evidence traceable to approved Notes. When approved Notes contain processed segment evidence locators, answer traceability MUST remain rooted in those approved Notes and MUST NOT require answer workflow to load raw Sources, draft understanding, or discussion-stage material.

#### Scenario: Answer is produced
- **WHEN** the system returns an answer
- **THEN** it includes references to the note objects used as evidence
- **AND** distinguishes approved notes from unavailable unapproved material

#### Scenario: Approved note contains segment locators
- **WHEN** an approved Note used for answering contains `source_refs[].evidence_refs` in the form `processed/segments.json#<segment_id>`
- **THEN** the answer workflow may preserve or display those refs as part of note traceability
- **AND** it does not treat the referenced Source, raw material, draft understanding, or discussion summary as additional answer evidence
