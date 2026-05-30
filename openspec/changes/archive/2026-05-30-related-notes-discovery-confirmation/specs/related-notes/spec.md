## ADDED Requirements

### Requirement: Related Note Discovery Uses Approved Notes

The system SHALL generate related note candidates only from approved Notes. Draft, archived, superseded, unapproved, Source, Candidate, and raw material records MUST NOT be used as main related note candidates.

#### Scenario: Candidates are generated from approved Notes
- **WHEN** related note discovery runs for a Source or Note composition context
- **THEN** each candidate references an approved Note id
- **AND** each candidate includes the approved Note title
- **AND** each candidate includes a relation reason

#### Scenario: Non-approved Notes are excluded
- **WHEN** draft, archived, superseded, or unapproved Notes exist
- **THEN** related note discovery omits them from candidates
- **AND** no omitted Note id can be confirmed into `related_note_ids`

### Requirement: Related Note Candidates Are Explainable

The system SHALL include an explainable reason for each related note candidate. The reason MUST be derived from visible Note metadata, title, conclusions, keywords, tags, or other approved Note fields, not from hidden model state.

#### Scenario: Candidate reason is displayed
- **WHEN** related note discovery returns a candidate
- **THEN** the candidate includes `note_id`, `title`, and `reason`
- **AND** the reason explains why the candidate may be related

### Requirement: Related Note Confirmation Is Explicit

The system SHALL require explicit user or workflow confirmation before a related note candidate can be written into `Note.related_note_ids`.

#### Scenario: User confirms a candidate
- **WHEN** a related note candidate is confirmed
- **THEN** the candidate Note id becomes eligible for `Note.related_note_ids`

#### Scenario: User rejects a candidate
- **WHEN** a related note candidate is rejected
- **THEN** the candidate Note id is not eligible for `Note.related_note_ids`

#### Scenario: Candidate is not confirmed
- **WHEN** a candidate has not been confirmed
- **THEN** the workflow MUST NOT write that candidate Note id into `Note.related_note_ids`

### Requirement: Related Note Discovery Supports JSON Output

The system SHALL provide machine-readable output for related note discovery and confirmation workflows.

#### Scenario: User requests JSON discovery output
- **WHEN** the user requests JSON output for related note discovery
- **THEN** the output includes candidate Note ids, titles, reasons, and confirmation status
