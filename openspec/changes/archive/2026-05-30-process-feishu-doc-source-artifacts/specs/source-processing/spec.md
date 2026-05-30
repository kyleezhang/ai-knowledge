## MODIFIED Requirements

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
