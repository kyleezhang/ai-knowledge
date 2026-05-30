## ADDED Requirements

### Requirement: Feishu Doc Processing Uses Imported Markdown Snapshot

系统 SHALL process Feishu Doc Sources by reading the imported Markdown snapshot from `raw/original.md` and MUST NOT refetch or reread the remote Feishu document during `ai-knowledge source process <source_id>`.

#### Scenario: Feishu Doc Markdown snapshot is available
- **WHEN** `ai-knowledge source process <source_id>` is executed for an `ingested` Feishu Doc Source with `raw/original.md`
- **THEN** the workflow reads `raw/original.md` as the processor input
- **AND** the remote Feishu document is not fetched again during processing
- **AND** successful processing writes `processed/clean_text.md`, `processed/segments.json`, and `processed/metadata.json`
- **AND** the `Source` transitions through `ingested -> processing -> processed`

#### Scenario: Feishu Doc Markdown snapshot is missing
- **WHEN** processing starts for a Feishu Doc Source but `raw/original.md` cannot be read
- **THEN** the workflow fails the processing operation
- **AND** records `last_error.stage = processing` when the Source can be persisted
- **AND** the original raw Feishu artifact remains available under `raw/`

### Requirement: Feishu Doc Segments Use Consistent Processed Locators

系统 SHALL produce processed segment locators for Feishu Doc Sources using the same normalized locator contract as other supported document inputs.

#### Scenario: Feishu Doc segment locator is produced
- **WHEN** a Feishu Doc Source is processed
- **THEN** each segment in `processed/segments.json` includes `id`, `order`, `heading_path`, `text`, and `locator`
- **AND** `locator.ref` equals `processed/segments.json#<segment_id>`
- **AND** `locator.source_kind` identifies the segment as Feishu-Doc-derived
- **AND** locator includes heading path, block identifier, or equivalent imported document position when available
