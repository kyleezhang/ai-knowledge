## ADDED Requirements

### Requirement: Candidate Selection Creates Source
系统 SHALL allow selected recommended Candidates to create Sources through an explicit user action. Candidate-created Sources MUST use `ingest_type = candidate_selected`, `origin.type = candidate`, and MUST start at `ingested` status.

#### Scenario: Candidate Source is created
- **WHEN** Candidate select workflow creates a Source from a Candidate
- **THEN** Source status MUST be `ingested`
- **AND** Source ingest_type MUST be `candidate_selected`
- **AND** Source content_type MUST be `link`
- **AND** Source origin.type MUST be `candidate`
- **AND** Source origin.candidate_id MUST equal the Candidate id
- **AND** Source origin_candidate_id MUST equal the Candidate id

#### Scenario: Candidate Source preserves raw material
- **WHEN** Candidate select workflow creates a Source
- **THEN** Source raw artifact MUST preserve Candidate title、summary、url、tags and source_type in a processable Markdown file
- **AND** processing_artifacts MUST remain empty until source process runs
