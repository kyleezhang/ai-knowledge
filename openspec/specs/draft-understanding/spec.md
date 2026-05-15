# Draft Understanding Specification

## Purpose

This capability defines how the system creates the first structured interpretation of a processed `Source`. Draft understanding is discussion input, not approved knowledge.

## Requirements

### Requirement: Draft Understanding Requires Processed Artifacts

The system SHALL generate `draft_understanding` only from a `Source` that has valid processed artifacts.

#### Scenario: Processed source is understood
- **WHEN** a `Source` has status `processed` and valid `processing_artifacts`
- **THEN** the system may generate `draft_understanding`
- **AND** the generated structure is embedded in `source.json`

#### Scenario: Missing processed artifacts
- **WHEN** a workflow requests draft understanding for a `Source` without processed artifacts
- **THEN** the system rejects the request
- **AND** no `draft_understanding` is persisted

### Requirement: Agent Output Is Schema Validated

The system SHALL validate all agent-produced draft understanding before workflow continuation.

#### Scenario: Agent returns valid draft understanding
- **WHEN** the agent output satisfies the draft-understanding schema
- **THEN** the workflow may persist it
- **AND** the `Source` may transition to `understanding_ready`

#### Scenario: Agent returns invalid draft understanding
- **WHEN** the agent output fails schema validation
- **THEN** the workflow fails without silently repairing the output
- **AND** the `Source` does not transition to `understanding_ready`

### Requirement: Draft Understanding Is Not Formal Knowledge

The system SHALL treat `draft_understanding` as preliminary discussion material only.

#### Scenario: Note is requested from draft understanding
- **WHEN** a workflow attempts to create a formal `Note` from `draft_understanding` alone
- **THEN** the system rejects the operation
- **AND** requires discussion convergence and explicit user approval first

### Requirement: Draft Understanding Captures Uncertainty

The system SHALL include uncertainty and discussion prompts in generated draft understanding.

#### Scenario: Draft understanding is generated
- **WHEN** the system stores `draft_understanding`
- **THEN** it includes summary, key points, uncertainties, discussion starters, and generation time
- **AND** these fields remain subordinate to later user-confirmed discussion results
