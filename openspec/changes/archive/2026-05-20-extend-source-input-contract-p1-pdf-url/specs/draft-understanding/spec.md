## MODIFIED Requirements

### Requirement: Draft Understanding Requires Processed Artifacts
The system SHALL generate `draft_understanding` only from a `Source` that has status `processed` and valid processed artifacts. For Markdown, PDF, and explicit URL Sources, draft understanding MUST consume `processing_artifacts.clean_text`, `processing_artifacts.segments`, and `processing_artifacts.metadata` through workflow-managed storage reads, and MUST NOT depend on input-specific raw files such as `raw/original.pdf` or `raw/fetched.html`.

#### Scenario: Processed source is understood
- **WHEN** a `Source` has status `processed` and valid `processing_artifacts`
- **THEN** the system may generate `draft_understanding`
- **AND** the generated structure is embedded in `source.json`

#### Scenario: Missing processed artifacts
- **WHEN** a workflow requests draft understanding for a `Source` without processed artifacts
- **THEN** the system rejects the request
- **AND** no `draft_understanding` is persisted

#### Scenario: Source is not processed
- **WHEN** a workflow requests draft understanding for a `Source` whose status is not `processed`
- **THEN** the system rejects the request
- **AND** the existing Source status remains unchanged

#### Scenario: PDF or URL source is understood from normalized artifacts
- **WHEN** the workflow generates draft understanding for a processed PDF or URL Source
- **THEN** it reads only the normalized processed artifacts through storage-managed paths
- **AND** the Understand Agent remains agnostic to the original raw input format
