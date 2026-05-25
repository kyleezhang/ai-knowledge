## MODIFIED Requirements

### Requirement: Processing Produces Artifacts
The system SHALL create explicit normalized processing artifacts before a source is considered processed. For Markdown, PDF, and explicit URL Sources, the artifacts MUST include `processed/clean_text.md`, `processed/segments.json`, and `processed/metadata.json`, and `source.processing_artifacts` MUST record the relative paths using keys `clean_text`, `segments`, and `metadata`. Format-specific details such as page references or fetch metadata MUST live inside those normalized artifacts rather than in new workflow-only fields.

#### Scenario: Processing succeeds
- **WHEN** processing completes successfully for a supported Source input
- **THEN** the system records artifact paths in `source.processing_artifacts`
- **AND** the `Source` transitions to `processed`

#### Scenario: Markdown artifacts are written
- **WHEN** a Markdown `Source` is processed successfully
- **THEN** the system writes `processed/clean_text.md`
- **AND** the system writes `processed/segments.json`
- **AND** the system writes `processed/metadata.json`
- **AND** each recorded artifact path is relative to the Source directory

#### Scenario: PDF artifacts are written
- **WHEN** a PDF `Source` is processed successfully
- **THEN** the system writes extracted PDF text to `processed/clean_text.md`
- **AND** the system writes normalized page-aware or section-aware segments to `processed/segments.json`
- **AND** the system writes extracted PDF metadata, including page count when available, to `processed/metadata.json`
- **AND** each recorded artifact path is relative to the Source directory
- **AND** PDF-specific extraction details remain inside those normalized artifacts rather than new `Source` fields

#### Scenario: URL artifacts are written
- **WHEN** an explicit URL `Source` is processed successfully
- **THEN** the system writes `processed/clean_text.md`
- **AND** the system writes `processed/segments.json`
- **AND** the system writes `processed/metadata.json`
- **AND** fetch metadata is stored inside normalized artifacts
- **AND** each recorded artifact path is relative to the Source directory

### Requirement: Processing Failure Records Last Error
The system SHALL preserve imported raw material on processing failure, transition the Source to `failed` when possible, and write `last_error.stage = processing` with a readable message and occurrence time.

#### Scenario: Processor fails
- **WHEN** Markdown, PDF, or URL normalization fails during processing
- **THEN** the Source transitions to `failed`
- **AND** `last_error.stage` is `processing`
- **AND** the corresponding raw source artifact remains available

#### Scenario: Raw PDF is missing during processing
- **WHEN** PDF processing starts but `raw/original.pdf` cannot be read
- **THEN** the workflow returns a processing failure
- **AND** the Source transitions to `failed` when the Source can be persisted
- **AND** `last_error.stage` is `processing`
- **AND** no formal `Note` or main index entry is created

#### Scenario: Artifact write fails
- **WHEN** required processed artifacts cannot be written
- **THEN** the workflow returns a processing failure
- **AND** records `last_error.stage = processing` when the Source can be persisted

### Requirement: Source Process CLI Reports Next Action
The system SHALL expose Markdown, PDF, and URL processing through `ai-knowledge source process <source_id>` and SHALL report the next workflow action after success.

#### Scenario: CLI processing succeeds
- **WHEN** a user runs `ai-knowledge source process <source_id>` for a supported Markdown, PDF, or URL Source and processing succeeds
- **THEN** the CLI reports that the Source was processed
- **AND** the CLI displays the next action command `ai-knowledge source understand <source_id>`

#### Scenario: CLI JSON output is requested
- **WHEN** a user runs `ai-knowledge source process <source_id> --json` for a supported Markdown, PDF, or URL Source
- **THEN** the CLI returns a JSON representation of the workflow result
- **AND** the JSON includes the processed Source data or summary and the next action command

### Requirement: PDF Processing Uses Raw Original
The system SHALL process PDF Sources by reading `raw/original.pdf` from the Source directory and MUST NOT synthesize PDF content from `source.json`, discussion logs, generated Note files, or previously generated draft understanding.

#### Scenario: Raw PDF is available
- **WHEN** `ai-knowledge source process <source_id>` is executed for an `ingested` PDF Source with `raw/original.pdf`
- **THEN** the workflow reads `raw/original.pdf` as the processor input
- **AND** the original raw file remains unchanged
- **AND** successful processing writes the standard processed artifact set

#### Scenario: Raw PDF is missing
- **WHEN** processing starts for a PDF Source but `raw/original.pdf` cannot be read
- **THEN** the workflow fails the processing operation
- **AND** records the failure as a processing-stage error
- **AND** leaves generated Note and index state unchanged
