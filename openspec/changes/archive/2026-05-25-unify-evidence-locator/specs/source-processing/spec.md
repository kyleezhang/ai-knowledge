## MODIFIED Requirements

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

## ADDED Requirements

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
