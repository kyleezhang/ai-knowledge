## ADDED Requirements

### Requirement: Hybrid Retrieval Combines Signals At Note Level
The system SHALL combine keyword, metadata, and vector retrieval signals into Note-level retrieval results. Hybrid retrieval MUST deduplicate candidates by `note_id` before applying top-k selection.

#### Scenario: Multiple signals match the same Note
- **WHEN** keyword and vector retrieval both match the same approved Note
- **THEN** hybrid retrieval returns one result for that `note_id`
- **AND** the result includes both signal explanations

#### Scenario: Multiple chunks match the same Note
- **WHEN** vector retrieval returns multiple chunk hits for one Note
- **THEN** hybrid retrieval merges them into one Note-level candidate
- **AND** top-k selection counts the Note once

### Requirement: Hybrid Retrieval Uses Approved Main Index As Candidate Boundary
The system SHALL start hybrid retrieval from approved main Index Entries. Hybrid retrieval MUST NOT return draft, archived, superseded, missing, or unloadable Notes.

#### Scenario: Approved index entry is matched
- **WHEN** an approved Index Entry matches hybrid retrieval
- **THEN** the workflow may load the corresponding approved `note.json`
- **AND** include it as a candidate result

#### Scenario: Indexed Note is no longer approved
- **WHEN** a matching Index Entry points to a Note whose status is not `approved`
- **THEN** hybrid retrieval skips that Note
- **AND** does not return it through keyword, metadata, or vector signals

#### Scenario: Vector hit references archived Note
- **WHEN** a vector hit references an archived or superseded Note
- **THEN** hybrid retrieval excludes that hit from main results
- **AND** does not use vector metadata to answer from that Note

### Requirement: Metadata Filters And Boosts Are Applied From Index Entries
The system SHALL support metadata filters and boosts using Index Entry fields. Filters MUST restrict candidates before final ranking, while boosts MAY increase scores for matching approved candidates.

#### Scenario: Tag filter is applied
- **WHEN** hybrid retrieval is called with a tag filter
- **THEN** only approved Index Entries containing that tag are eligible candidates

#### Scenario: Keyword boost is applied
- **WHEN** a candidate Index Entry contains a boosted keyword
- **THEN** hybrid retrieval increases that candidate's metadata signal score
- **AND** still requires the corresponding Note to be approved before returning it

#### Scenario: Approved date range filter is applied
- **WHEN** hybrid retrieval is called with an `approved_at` date range filter
- **THEN** candidates outside that range are excluded before final ranking

### Requirement: Hybrid Scores Are Deterministic And Explainable
The system SHALL calculate deterministic hybrid scores from normalized keyword, metadata, and vector signals. Each result MUST include enough score explanation to identify which signals contributed to the final rank.

#### Scenario: Candidate has all signals
- **WHEN** a candidate has keyword, metadata, and vector matches
- **THEN** the result includes each signal type, score, and explanation
- **AND** the final score is calculated deterministically from configured weights

#### Scenario: Scores tie
- **WHEN** two candidates have the same final hybrid score
- **THEN** retrieval sorts by `approved_at` descending
- **AND** then by `note_id` ascending for deterministic output

### Requirement: Vector Signal Is Optional In Hybrid Retrieval
The system SHALL treat vector retrieval as an optional signal. If query embedding or vector index loading is unavailable, hybrid retrieval MUST continue with keyword and metadata signals and expose the vector-unavailable reason in debug output.

#### Scenario: Query embedding provider fails
- **WHEN** hybrid retrieval cannot generate a query embedding
- **THEN** vector signal is omitted from scoring
- **AND** keyword and metadata retrieval may still return approved Notes

#### Scenario: Candidate has no vector_ref
- **WHEN** a matching approved Index Entry has `vector_ref = null`
- **THEN** hybrid retrieval scores keyword and metadata signals for that candidate
- **AND** records that vector signal is unavailable for that candidate when debug output is requested

#### Scenario: Vector dimensions mismatch
- **WHEN** a vector index has dimensions incompatible with the query embedding
- **THEN** hybrid retrieval omits the vector signal for that index
- **AND** does not fail the entire retrieval request

### Requirement: Hybrid Retrieval Results Are Retrieval Metadata
The system SHALL treat hybrid retrieval results as retrieval metadata. Results MUST locate approved Notes and MUST NOT become formal knowledge truth or answer evidence by themselves.

#### Scenario: Hybrid result is passed to answer workflow
- **WHEN** answer workflow receives hybrid retrieval results
- **THEN** it loads approved `note.json` records for the result `note_id`s
- **AND** passes approved Notes, not retrieval metadata, to the Answer Agent

#### Scenario: Hybrid explanation contains chunk text
- **WHEN** a retrieval explanation includes vector chunk context for debugging
- **THEN** that context is not treated as answer evidence
- **AND** answer generation remains grounded in approved Note JSON
