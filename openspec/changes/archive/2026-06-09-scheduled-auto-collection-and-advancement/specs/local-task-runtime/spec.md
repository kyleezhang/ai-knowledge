## ADDED Requirements

### Requirement: Scheduler enqueues automation as LocalTask work
The system SHALL allow scheduler workflows to enqueue safe automation work as `LocalTask` objects. Scheduler-created tasks MUST use validated task payloads, MUST store only ids and options, and MUST be executed by the existing task runner or task daemon.

#### Scenario: Scheduler enqueues source processing
- **WHEN** scheduler decides to advance an ingested Source by processing it
- **THEN** it MUST create a `LocalTask` with a safe `source.process` payload
- **AND** the task runner MUST call the existing source processing workflow

#### Scenario: Scheduler enqueues note indexing
- **WHEN** scheduler decides to index an approved Note
- **THEN** it MUST create a `LocalTask` with a safe `note.index` payload
- **AND** the task runner MUST call the existing note indexing workflow

### Requirement: Scheduler-created tasks preserve workflow gates
The system SHALL preserve all existing workflow gates for scheduler-created tasks. The scheduler MUST NOT mark task attempts successful unless the invoked workflow succeeds, and MUST NOT repair or bypass workflow rejection.

#### Scenario: Scheduler-created task violates workflow state gate
- **WHEN** a scheduler-created task targets an object whose state no longer satisfies the workflow precondition
- **THEN** the task runner MUST record the workflow failure in the task attempt
- **AND** the scheduler MUST NOT directly mutate the business object to make the task succeed

#### Scenario: Scheduler-created note index task targets draft note
- **WHEN** a scheduler-created `note.index` task targets a Note that is not `approved`
- **THEN** the note indexing workflow MUST reject the task
- **AND** no main index entry MUST be created

### Requirement: Task daemon can run scheduler-created tasks without special casing
The task daemon SHALL run scheduler-created LocalTasks through the same eligibility, claim, retry, and attempt recording behavior as manually enqueued LocalTasks.

#### Scenario: Daemon finds scheduler-created pending task
- **WHEN** task daemon scans a pending scheduler-created task
- **THEN** it MUST claim and execute the task using the same task runner path as manual `task run`
- **AND** attempt history MUST be recorded in the task object

#### Scenario: Scheduler-created task is retryable failed
- **WHEN** a scheduler-created task is `retryable_failed` and retry policy delay is due
- **THEN** daemon MAY retry it according to existing retry behavior
- **AND** previous attempts MUST remain unchanged
