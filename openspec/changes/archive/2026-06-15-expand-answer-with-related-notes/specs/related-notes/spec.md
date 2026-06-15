## MODIFIED Requirements

### Requirement: Related Note Discovery Uses Approved Notes
The system SHALL generate related note candidates only from approved Notes. Draft, archived, superseded, unapproved, Source, Candidate, and raw material records MUST NOT be used as main related note candidates. Answer context expansion using `related_note_ids` MUST also load only current approved Notes.

#### Scenario: Candidates are generated from approved Notes
- **WHEN** related note discovery runs for a Source or Note composition context
- **THEN** each candidate references an approved Note id
- **AND** each candidate includes the approved Note title
- **AND** each candidate includes a relation reason

#### Scenario: Non-approved Notes are excluded
- **WHEN** draft, archived, superseded, or unapproved Notes exist
- **THEN** related note discovery omits them from candidates
- **AND** no omitted Note id can be confirmed into `related_note_ids`

#### Scenario: Existing relation points to non-approved Note
- **WHEN** answer context expansion follows an existing `related_note_ids` entry
- **AND** the target Note is draft, archived, superseded, missing, or unloadable
- **THEN** the workflow skips that related Note
- **AND** records a debug reason when machine-readable output is requested

### Requirement: Related Note Confirmation Is Explicit
The system SHALL require explicit user or workflow confirmation before a related note candidate can be written into `Note.related_note_ids`. Answer context expansion MUST consume only already-confirmed `related_note_ids` and MUST NOT create, infer, or mutate relationships.

#### Scenario: User confirms a candidate
- **WHEN** a related note candidate is confirmed
- **THEN** the candidate Note id becomes eligible for `Note.related_note_ids`

#### Scenario: User rejects a candidate
- **WHEN** a related note candidate is rejected
- **THEN** the candidate Note id is not eligible for `Note.related_note_ids`

#### Scenario: Candidate is not confirmed
- **WHEN** a candidate has not been confirmed
- **THEN** the workflow MUST NOT write that candidate Note id into `Note.related_note_ids`

#### Scenario: Answer expands related context
- **WHEN** answer workflow uses `related_note_ids` to load supplementary context
- **THEN** it MUST NOT write new `related_note_ids`
- **AND** it MUST NOT modify Note objects or relationship data

### Requirement: Related Notes Can Supplement Answer Context
The system SHALL allow confirmed `related_note_ids` from directly matched approved Notes to provide one-hop supplementary answer context. The workflow MUST distinguish direct matches from related expansions and MUST cap related expansion to avoid unbounded answer context growth.

#### Scenario: Direct note has approved related note
- **WHEN** an approved Note directly matches an answer query
- **AND** that Note has `related_note_ids` pointing to another approved Note
- **THEN** answer workflow may include the related Note after direct matches in Answer Agent context
- **AND** marks the related Note as supplementary related context

#### Scenario: Related note is also directly matched
- **WHEN** a Note is both directly retrieved and reachable through `related_note_ids`
- **THEN** the workflow keeps the Note as a direct match
- **AND** does not duplicate it as related context

#### Scenario: Related expansion exceeds configured limit
- **WHEN** confirmed related notes exceed the configured expansion limit
- **THEN** the workflow includes only up to the limit
- **AND** records truncation information in debug output when requested
