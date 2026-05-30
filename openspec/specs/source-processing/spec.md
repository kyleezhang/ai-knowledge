# Source Processing Specification

## Purpose

This capability defines how imported material becomes processed artifacts that downstream understanding workflows can safely consume.
## Requirements
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

### Requirement: Processing Requires Ingested Source

The system SHALL process only sources that are in `ingested` status or in an explicitly retryable failure state.

#### Scenario: Source is ready for processing
- **WHEN** a `Source` has status `ingested`
- **THEN** processing may transition it to `processing`
- **AND** successful completion may transition it to `processed`

#### Scenario: Source is in incompatible status
- **WHEN** a workflow attempts to process a `Source` whose status is not processable
- **THEN** the system rejects the operation
- **AND** leaves the existing status unchanged

### Requirement: Processing Produces Artifacts
The system SHALL create explicit normalized processing artifacts before a source is considered processed. For Markdown, PDF, and explicit URL Sources, the artifacts MUST include `processed/clean_text.md`, `processed/segments.json`, and `processed/metadata.json`, and `source.processing_artifacts` MUST record the relative paths using keys `clean_text`, `segments`, and `metadata`. Format-specific details such as page references, section references, URL snapshot metadata, and evidence locator metadata MUST live inside those normalized artifacts rather than in new workflow-only fields. Each segment in `processed/segments.json` MUST expose a stable processed evidence locator whose `ref` can be used as `processed/segments.json#<segment_id>`.

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
- **AND** each segment exposes a locator ref in the form `processed/segments.json#<segment_id>`

#### Scenario: PDF or URL artifacts are written
- **WHEN** a PDF or explicit URL `Source` is processed successfully
- **THEN** the system writes `processed/clean_text.md`
- **AND** the system writes `processed/segments.json`
- **AND** the system writes `processed/metadata.json`
- **AND** format-specific page references, section references, URL snapshot metadata, or fetch metadata are stored inside those normalized artifacts
- **AND** each recorded artifact path is relative to the Source directory
- **AND** each segment exposes a locator ref in the form `processed/segments.json#<segment_id>`

### Requirement: Processed Segment Locators Are Cross-Source Consistent
The system SHALL produce a consistent processed segment locator shape for Markdown, PDF, and explicit URL Sources. Each segment MUST retain existing segment identity and text fields, and MUST include locator metadata that can explain the segment position without referencing raw files.

#### Scenario: Markdown segment locator is produced
- **WHEN** a Markdown `Source` is processed
- **THEN** each segment in `processed/segments.json` includes `id`, `order`, `heading_path`, `text`, and `locator`
- **AND** `locator.ref` equals `processed/segments.json#<segment_id>`
- **AND** `locator.source_kind` identifies the segment as Markdown-derived

#### Scenario: PDF segment locator is produced
- **WHEN** a PDF `Source` is processed
- **THEN** each segment in `processed/segments.json` includes `id`, `order`, `heading_path`, `text`, and `locator`
- **AND** `locator.ref` equals `processed/segments.json#<segment_id>`
- **AND** `locator.source_kind` identifies the segment as PDF-derived
- **AND** locator includes a page number or equivalent page-internal processed position

#### Scenario: URL segment locator is produced
- **WHEN** an explicit URL `Source` is processed
- **THEN** each segment in `processed/segments.json` includes `id`, `order`, `heading_path`, `text`, and `locator`
- **AND** `locator.ref` equals `processed/segments.json#<segment_id>`
- **AND** `locator.source_kind` identifies the segment as URL-derived
- **AND** locator includes heading path, section, or equivalent body position for the URL snapshot

### Requirement: Processing Preserves Raw Material

The system SHALL NOT rewrite or delete raw imported material to conceal processing failures.

#### Scenario: Processing fails
- **WHEN** the processor cannot parse or normalize the imported material
- **THEN** the raw material remains available under `raw/`
- **AND** the failure is recorded without replacing the original input

### Requirement: Processed Artifacts Gate Understanding

The system SHALL require processed artifacts before draft understanding can be generated.

#### Scenario: Understanding starts after processing
- **WHEN** a `Source` has status `processed` and valid `processing_artifacts`
- **THEN** the draft-understanding workflow may consume those artifacts

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
The system SHALL perform Markdown, PDF, and explicit URL processing through the Source state machine and MUST use the successful transition sequence `ingested -> processing -> processed`.

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
- **WHEN** Markdown, PDF, or URL normalization fails during processing
- **THEN** the Source transitions to `failed`
- **AND** `last_error.stage` is `processing`
- **AND** the corresponding raw source artifact remains available

#### Scenario: Artifact write fails
- **WHEN** required processed artifacts cannot be written
- **THEN** the workflow returns a processing failure
- **AND** records `last_error.stage = processing` when the Source can be persisted

### Requirement: Source Process CLI Reports Next Action
The system SHALL expose Markdown, PDF, and URL processing through `ai-knowledge source process <source_id>` and SHALL report the next workflow action after success.

#### Scenario: CLI processing succeeds
- **WHEN** a user runs `ai-knowledge source process <source_id>` and processing succeeds
- **THEN** the CLI reports that the Source was processed
- **AND** the CLI displays the next action command `ai-knowledge source understand <source_id>`

#### Scenario: CLI JSON output is requested
- **WHEN** a user runs `ai-knowledge source process <source_id> --json`
- **THEN** the CLI returns a JSON representation of the workflow result
- **AND** the JSON includes the processed Source data or summary and the next action command

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

### Requirement: Feishu Doc Processing Uses Imported Markdown Snapshot

系统 SHALL process Feishu Doc Sources by reading the imported Markdown snapshot from `raw/original.md` and MUST NOT refetch or reread the remote Feishu document during `ai-knowledge source process <source_id>`. Successful processing MUST write `processed/clean_text.md`, `processed/segments.json`, and `processed/metadata.json`, and MUST register those relative paths on `source.processing_artifacts` using keys `clean_text`, `segments`, and `metadata`.

#### Scenario: Feishu Doc Markdown snapshot is available
- **WHEN** `ai-knowledge source process <source_id>` is executed for an `ingested` Feishu Doc Source with `raw/original.md`
- **THEN** the workflow reads `raw/original.md` as the processor input
- **AND** the remote Feishu document is not fetched or read again during processing
- **AND** successful processing writes `processed/clean_text.md`, `processed/segments.json`, and `processed/metadata.json`
- **AND** `source.processing_artifacts.clean_text` equals `processed/clean_text.md`
- **AND** `source.processing_artifacts.segments` equals `processed/segments.json`
- **AND** `source.processing_artifacts.metadata` equals `processed/metadata.json`
- **AND** the `Source` transitions through `ingested -> processing -> processed` using the Source state machine

#### Scenario: Feishu Doc Markdown snapshot is missing
- **WHEN** processing starts for a Feishu Doc Source but `raw/original.md` cannot be read
- **THEN** the workflow fails the processing operation
- **AND** the `Source` transitions to `failed` when the Source can be persisted
- **AND** records `last_error.stage = processing` when the Source can be persisted
- **AND** the original raw Feishu artifact remains available under `raw/`

### Requirement: Feishu Doc Segments Use Consistent Processed Locators

系统 SHALL produce processed segment locators for Feishu Doc Sources using the same normalized locator contract as other supported document inputs. Each segment MUST retain existing segment identity and text fields, MUST expose a locator ref in the form `processed/segments.json#<segment_id>`, and MUST set `locator.source_kind = feishu_doc`.

#### Scenario: Feishu Doc segment locator is produced
- **WHEN** a Feishu Doc Source is processed
- **THEN** each segment in `processed/segments.json` includes `id`, `order`, `heading_path`, `text`, and `locator`
- **AND** `locator.ref` equals `processed/segments.json#<segment_id>`
- **AND** `locator.source_kind` equals `feishu_doc`
- **AND** `locator.position` equals the segment order
- **AND** `locator.heading_path` equals the segment heading path
- **AND** locator includes heading path, block identifier, or equivalent imported document position when available
