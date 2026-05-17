## MODIFIED Requirements

### Requirement: Processing Produces Artifacts
The system SHALL create explicit P0 Markdown processing artifacts before a source is considered processed. For Markdown sources, the artifacts MUST include `processed/clean_text.md`, `processed/segments.json`, and `processed/metadata.json`, and `source.processing_artifacts` MUST record the relative paths using keys `clean_text`, `segments`, and `metadata`.

#### Scenario: Processing succeeds
- **WHEN** Markdown processing completes successfully
- **THEN** the system records artifact paths in `source.processing_artifacts`
- **AND** the `Source` transitions to `processed`

#### Scenario: Markdown artifacts are written
- **WHEN** a Markdown `Source` is processed successfully
- **THEN** the system writes `processed/clean_text.md`
- **AND** the system writes `processed/segments.json`
- **AND** the system writes `processed/metadata.json`
- **AND** each recorded artifact path is relative to the Source directory

## ADDED Requirements

### Requirement: Markdown Processing Uses Raw Original
The system SHALL process P0 Markdown sources by reading `raw/original.md` from the Source directory and MUST NOT process Markdown from `source.json`, `draft_understanding`, discussion logs, or generated Note files.

#### Scenario: Raw Markdown is available
- **WHEN** `ai-knowledge source process <source_id>` is executed for an `ingested` Markdown Source with `raw/original.md`
- **THEN** the workflow reads `raw/original.md` as the processor input
- **AND** the original raw file remains unchanged

#### Scenario: Raw Markdown is missing
- **WHEN** processing starts but `raw/original.md` cannot be read
- **THEN** the workflow fails the processing operation
- **AND** records the failure as a processing-stage error

### Requirement: Processing State Transitions Are Explicit
The system SHALL perform Markdown processing through the Source state machine and MUST use the successful transition sequence `ingested -> processing -> processed`.

#### Scenario: Source enters processing
- **WHEN** processing starts for a Source whose status is `ingested`
- **THEN** the workflow transitions the Source to `processing`
- **AND** persists the state before producing final processed status

#### Scenario: Source processing completes
- **WHEN** all required processed artifacts have been written and registered
- **THEN** the workflow transitions the Source from `processing` to `processed`
- **AND** clears any previous `last_error`

#### Scenario: Source is not ingested
- **WHEN** a user requests processing for a Source whose status is not `ingested`
- **THEN** the system rejects the operation
- **AND** leaves the existing Source status unchanged

### Requirement: Processing Failure Records Last Error
The system SHALL preserve imported raw material on processing failure, transition the Source to `failed` when possible, and write `last_error.stage = processing` with a readable message and occurrence time.

#### Scenario: Processor fails
- **WHEN** Markdown parsing or normalization fails during processing
- **THEN** the Source transitions to `failed`
- **AND** `last_error.stage` is `processing`
- **AND** `raw/original.md` remains available

#### Scenario: Artifact write fails
- **WHEN** required processed artifacts cannot be written
- **THEN** the workflow returns a processing failure
- **AND** records `last_error.stage = processing` when the Source can be persisted

### Requirement: Source Process CLI Reports Next Action
The system SHALL expose Markdown processing through `ai-knowledge source process <source_id>` and SHALL report the next workflow action after success.

#### Scenario: CLI processing succeeds
- **WHEN** a user runs `ai-knowledge source process <source_id>` and processing succeeds
- **THEN** the CLI reports that the Source was processed
- **AND** the CLI displays the next action command `ai-knowledge source understand <source_id>`

#### Scenario: CLI JSON output is requested
- **WHEN** a user runs `ai-knowledge source process <source_id> --json`
- **THEN** the CLI returns a JSON representation of the workflow result
- **AND** the JSON includes the processed Source data or summary and the next action command
