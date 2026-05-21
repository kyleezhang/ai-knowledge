## MODIFIED Requirements

### Requirement: P0 Processes Markdown Only
The system SHALL support Markdown processing in P0 and SHALL extend manual Source processing in P1 to include PDF and explicit public URL inputs. Outside those accepted P1 inputs, the system SHALL continue to treat other formats and broader web collection as unsupported future-phase capabilities.

#### Scenario: Markdown source is processed
- **WHEN** a `Source` originated from a Markdown import
- **THEN** the system may process it into normalized text and metadata artifacts
- **AND** the `Source` may advance through the processing workflow

#### Scenario: PDF source is processed
- **WHEN** a `Source` originated from a PDF import
- **THEN** the system may process it into normalized text, page-aware or section-aware segments, and metadata artifacts
- **AND** the `Source` may advance through the processing workflow

#### Scenario: Explicit URL source is processed
- **WHEN** a `Source` originated from an accepted explicit URL import
- **THEN** the system may process the stored page snapshot into readable text, segments, and metadata artifacts
- **AND** the `Source` may advance through the processing workflow

#### Scenario: Unsupported broader web collection is requested
- **WHEN** a workflow would need crawling, search expansion, or authenticated refetch beyond the accepted URL snapshot
- **THEN** the capability is considered unsupported for this change
- **AND** no extra crawling or authenticated fetch step is introduced

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

#### Scenario: PDF or URL artifacts are written
- **WHEN** a PDF or explicit URL `Source` is processed successfully
- **THEN** the system writes `processed/clean_text.md`
- **AND** the system writes `processed/segments.json`
- **AND** the system writes `processed/metadata.json`
- **AND** format-specific page references or fetch metadata are stored inside those normalized artifacts
- **AND** each recorded artifact path is relative to the Source directory

## ADDED Requirements

### Requirement: PDF Processing Uses Raw Original
The system SHALL process PDF Sources by reading `raw/original.pdf` from the Source directory and MUST NOT synthesize PDF content from `source.json`, discussion logs, or generated Note files.

#### Scenario: Raw PDF is available
- **WHEN** `ai-knowledge source process <source_id>` is executed for an `ingested` PDF Source with `raw/original.pdf`
- **THEN** the workflow reads `raw/original.pdf` as the processor input
- **AND** the original raw file remains unchanged

#### Scenario: Raw PDF is missing
- **WHEN** processing starts for a PDF Source but `raw/original.pdf` cannot be read
- **THEN** the workflow fails the processing operation
- **AND** records the failure as a processing-stage error

### Requirement: URL Processing Uses Frozen Snapshot
The system SHALL process accepted URL Sources by reading `raw/fetched.html` from the Source directory and MUST NOT refetch the remote page during `ai-knowledge source process <source_id>`.

#### Scenario: Fetched snapshot is available
- **WHEN** `ai-knowledge source process <source_id>` is executed for an `ingested` URL Source with `raw/fetched.html`
- **THEN** the workflow reads `raw/fetched.html` as the processor input
- **AND** the remote page is not fetched again during processing

#### Scenario: Fetched snapshot is missing
- **WHEN** processing starts for a URL Source but `raw/fetched.html` cannot be read
- **THEN** the workflow fails the processing operation
- **AND** records the failure as a processing-stage error
