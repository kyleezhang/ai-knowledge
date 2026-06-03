## ADDED Requirements

### Requirement: Draft Understanding May Run As Local Task
The system SHALL allow draft understanding generation to be enqueued and run as a local task. The task runner MUST call the existing understanding workflow and MUST preserve processed artifact and LLM schema validation gates.

#### Scenario: Understanding task runs
- **WHEN** a `source.understand` task is executed for a processed Source
- **THEN** the runner calls the draft understanding workflow
- **AND** LLM output must pass schema validation before Source state changes

#### Scenario: Understanding task runs too early
- **WHEN** a `source.understand` task targets a Source without processed artifacts
- **THEN** the task attempt records a non-retryable failure
- **AND** no `draft_understanding` is created
