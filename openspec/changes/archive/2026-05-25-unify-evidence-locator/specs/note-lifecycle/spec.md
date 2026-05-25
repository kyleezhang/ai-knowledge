## MODIFIED Requirements

### Requirement: Note Lint Checks Required Knowledge Fields
The system SHALL check the minimum required `note.json` fields before a Note can pass lint. In addition to required semantic fields, lint MUST validate that `source_refs[].evidence_refs` are non-empty processed segment locators in the form `processed/segments.json#<segment_id>` and MUST reject raw material paths or artifact-level refs that do not identify a segment.

#### Scenario: Required fields are present
- **WHEN** a draft Note contains non-empty `source_refs`, `conclusions`, `why_it_matters`, `approval_context.source_id`, and positive `approval_context.approved_from_summary_version`
- **AND** each `source_refs[].evidence_refs` value is a valid processed segment locator
- **THEN** those required-field checks pass

#### Scenario: Required fields are missing
- **WHEN** a draft Note has empty `source_refs`, `conclusions`, `why_it_matters`, missing `approval_context.source_id`, or invalid `approved_from_summary_version`
- **THEN** lint fails
- **AND** reports the missing or invalid field

#### Scenario: Evidence ref points to raw material
- **WHEN** a draft Note has `source_refs[].evidence_refs` containing a raw path such as `raw/original.pdf#page=1` or `raw/original.html#intro`
- **THEN** lint fails
- **AND** reports that formal Note evidence refs must reference processed segments

#### Scenario: Evidence ref omits segment anchor
- **WHEN** a draft Note has `source_refs[].evidence_refs` containing `processed/segments.json`, `processed/clean_text.md`, or `processed/metadata.json`
- **THEN** lint fails
- **AND** reports that the evidence ref must use `processed/segments.json#<segment_id>`

## ADDED Requirements

### Requirement: Note Composition Uses Allowed Evidence Locators
The system SHALL provide Note Agent with evidence refs derived from processed segments and SHALL reject Note candidate output that references locators outside that allowed set.

#### Scenario: Note candidate uses allowed locator
- **WHEN** `note compose` runs for an approved Source with processed segments
- **AND** the Note Agent returns `source_refs[].evidence_refs` that are all present in the processed segment locator set
- **THEN** the workflow may accept the candidate after all other Note validation passes

#### Scenario: Note candidate invents locator
- **WHEN** the Note Agent returns `source_refs[].evidence_refs` containing a locator not present in the processed segment locator set
- **THEN** the workflow rejects the candidate
- **AND** does not silently rewrite the locator
- **AND** does not create a formal Note from that candidate

#### Scenario: Note composition prepares source refs
- **WHEN** `note compose` prepares source refs for an approved Source
- **THEN** it derives evidence refs from `processed/segments.json` segment locators
- **AND** it does not expose `processed/clean_text.md` or `processed/metadata.json` as formal evidence refs
