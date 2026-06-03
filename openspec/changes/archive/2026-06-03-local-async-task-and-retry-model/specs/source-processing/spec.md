## ADDED Requirements

### Requirement: Source Processing May Run As Local Task
The system SHALL allow Source processing to be enqueued and run as a local task. Task execution MUST call the existing Source processing workflow and preserve processing state gates.

#### Scenario: Source processing task runs
- **WHEN** a `source.process` task is executed for an ingested Source
- **THEN** the runner calls the Source processing workflow
- **AND** the Source may transition through the normal processing workflow

#### Scenario: Source processing task is invalid
- **WHEN** a `source.process` task targets a Source that cannot be processed in its current state
- **THEN** the task attempt records a non-retryable failure
- **AND** the runner does not directly modify Source status
