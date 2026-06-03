## ADDED Requirements

### Requirement: Vector Indexing May Retry As Local Task
The system SHALL allow vector index build or rebuild to run as a local task. Retryable provider or storage failures MAY be retried, but invalid Note state and vector validation failures MUST NOT produce a main-retrievable vector entry.

#### Scenario: Vector indexing task succeeds
- **WHEN** a `note.vector_index` task succeeds for an approved Note
- **THEN** the runner records task success
- **AND** the vector index result follows existing vector indexing validation rules

#### Scenario: Vector provider fails temporarily
- **WHEN** vector indexing fails due to a retryable provider or storage error
- **THEN** the task transitions to `retryable_failed` if attempts remain
- **AND** no invalid `vector_ref` is written

#### Scenario: Vector indexing validation fails
- **WHEN** vector output fails validation
- **THEN** the task transitions to `failed`
- **AND** no main-retrievable vector entry is created
