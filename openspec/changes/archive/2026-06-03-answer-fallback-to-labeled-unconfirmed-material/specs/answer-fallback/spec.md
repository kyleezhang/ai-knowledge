## ADDED Requirements

### Requirement: Fallback Requires Explicit Opt In
The system SHALL use unconfirmed materials for answers only when fallback is explicitly enabled. Default answer behavior MUST continue to use approved Notes only.

#### Scenario: Default answer has no approved matches
- **WHEN** the user asks a question without enabling fallback and no approved Notes match
- **THEN** the system reports that there is no related confirmed knowledge
- **AND** does not retrieve unconfirmed materials

#### Scenario: Fallback is enabled
- **WHEN** the user asks a question with fallback explicitly enabled
- **THEN** the system may retrieve eligible unconfirmed materials as secondary evidence
- **AND** approved Notes remain primary evidence when available

### Requirement: Fallback Uses Only Structured Unconfirmed Materials
The system SHALL use only structured unconfirmed materials for fallback evidence. Eligible materials are processed Source artifacts, `draft_understanding`, and discussion summary. Raw artifacts and Candidates MUST NOT be used as fallback answer evidence.

#### Scenario: Processed Source is eligible
- **WHEN** a Source has processed artifacts relevant to the question
- **THEN** fallback retrieval may create unconfirmed evidence from those processed artifacts
- **AND** the evidence includes a source trace reference

#### Scenario: Draft understanding is eligible
- **WHEN** a Source has `draft_understanding` relevant to the question
- **THEN** fallback retrieval may create unconfirmed evidence from that draft understanding
- **AND** labels it as unconfirmed

#### Scenario: Raw artifact exists
- **WHEN** a Source has raw artifacts but no eligible structured material
- **THEN** fallback retrieval does not use raw artifacts as answer evidence

### Requirement: Fallback Evidence Is Explicitly Labeled
The system SHALL label every fallback evidence item as unconfirmed. Each item MUST include `confirmation_status = unconfirmed`, `material_type`, `source_id`, `source_title`, `source_status`, `evidence_ref`, `excerpt`, and `limitations`.

#### Scenario: Fallback evidence is returned
- **WHEN** fallback retrieval returns an evidence item
- **THEN** the item includes the required unconfirmed labeling fields
- **AND** the limitations explain that the material has not become approved knowledge

#### Scenario: Fallback evidence lacks label
- **WHEN** a fallback evidence item lacks `confirmation_status = unconfirmed`
- **THEN** the system rejects the fallback result
- **AND** does not pass the item to the Answer Agent

### Requirement: Fallback Does Not Mutate Knowledge State
The system SHALL NOT create Notes, write main Index Entries, or mutate Source or Note statuses during answer fallback.

#### Scenario: Fallback answer is generated
- **WHEN** answer workflow uses unconfirmed fallback materials
- **THEN** no Source status is changed
- **AND** no Note status is changed
- **AND** no main Index Entry is created for fallback material

### Requirement: Fallback Evidence Is Separate From Approved Evidence
The system SHALL keep fallback evidence separate from approved Note evidence in workflow data and agent input. Fallback evidence MUST NOT be represented as a `Note`.

#### Scenario: Answer Agent is called with fallback materials
- **WHEN** answer workflow invokes the Answer Agent with fallback enabled
- **THEN** approved Notes are passed as primary evidence
- **AND** unconfirmed materials are passed separately as secondary evidence

#### Scenario: Output includes fallback materials
- **WHEN** an answer uses unconfirmed materials
- **THEN** the answer output identifies those materials separately from approved Notes
- **AND** includes their unconfirmed limitations
