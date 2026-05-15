# Source Processing Specification

## Purpose

This capability defines how imported material becomes processed artifacts that downstream understanding workflows can safely consume.

## Requirements

### Requirement: P0 Processes Markdown Only

The system SHALL support Markdown processing in P0 and SHALL treat PDF and other formats as future-phase capabilities.

#### Scenario: Markdown source is processed
- **WHEN** a `Source` originated from a Markdown import
- **THEN** the system may process it into normalized text and metadata artifacts
- **AND** the `Source` may advance through the processing workflow

#### Scenario: PDF source is requested in P0
- **WHEN** a user requests PDF processing without an accepted scope-expansion change
- **THEN** the system reports that PDF processing is outside P0
- **AND** does not add PDF-specific dependencies or artifacts

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

The system SHALL create explicit `processing_artifacts` before a source is considered processed.

#### Scenario: Processing succeeds
- **WHEN** Markdown processing completes successfully
- **THEN** the system records artifact paths in `source.processing_artifacts`
- **AND** the `Source` transitions to `processed`

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
