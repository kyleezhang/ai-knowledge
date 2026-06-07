## ADDED Requirements

### Requirement: Task Daemon Runs Eligible Local Tasks
The system SHALL provide a local task daemon that continuously runs eligible filesystem-backed `LocalTask` objects by calling the existing task runner. The daemon MUST NOT directly mutate Source, Note, Index Entry, Vector Index, Candidate, or other business objects.

#### Scenario: Daemon runs pending task
- **WHEN** the daemon finds a `pending` task in `knowledge/tasks/`
- **THEN** it claims the task and invokes the existing task runner
- **AND** the business work is executed through the same workflow path as `task run`

#### Scenario: Daemon ignores ineligible tasks
- **WHEN** the daemon scans tasks with status `running`, `succeeded`, `failed`, or `cancelled`
- **THEN** it does not run those tasks
- **AND** it leaves their attempt history unchanged

### Requirement: Daemon Respects Retry Eligibility
The system SHALL only auto-run `retryable_failed` tasks when their retry policy allows another attempt and the retry delay is due. The daemon MUST preserve previous attempts unchanged when it schedules a retry attempt.

#### Scenario: Retryable task is due
- **WHEN** a task is `retryable_failed`, attempts remain, and its retry delay is due
- **THEN** the daemon claims the task and creates a new attempt through the existing task runner
- **AND** previous attempt records remain unchanged

#### Scenario: Retryable task is not due
- **WHEN** a task is `retryable_failed` but its retry delay is not yet due
- **THEN** the daemon does not run the task
- **AND** the task remains eligible for a later daemon scan

### Requirement: Task Claim Prevents Duplicate Execution
The system SHALL use storage-layer helpers to atomically claim a task before execution. A task claimed by one runner MUST NOT be executed concurrently by another daemon instance or manual `task run` invocation.

#### Scenario: Two runners claim same task
- **WHEN** two daemon instances or a daemon and manual runner attempt to claim the same eligible task
- **THEN** at most one claim succeeds
- **AND** only the successful claimant executes the task attempt

#### Scenario: Claim is stale
- **WHEN** a task claim or running lease is older than the configured lease timeout
- **THEN** a later daemon run may reclaim the task according to task state-machine rules
- **AND** the system preserves existing attempt history for auditability

### Requirement: Daemon Supports Bounded Foreground Execution
The system SHALL expose a foreground CLI command for daemon execution with bounded-run controls. The command MUST support running continuously and MUST also support finite runs for tests and scripts.

#### Scenario: User starts daemon
- **WHEN** the user runs `ai-knowledge task daemon`
- **THEN** the system starts a foreground scheduling loop
- **AND** it reports task executions and idle status to the user

#### Scenario: User limits task executions
- **WHEN** the user runs the daemon with a maximum run count
- **THEN** the daemon exits after running that many tasks or when no eligible tasks remain under the configured idle policy

#### Scenario: User requests machine-readable daemon summary
- **WHEN** the user runs the daemon with `--json`
- **THEN** the CLI returns a machine-readable summary of the daemon session

### Requirement: Daemon Stops Gracefully
The system SHALL support graceful daemon shutdown. A graceful stop MUST allow the currently running task attempt to finish or record its failure boundary before the daemon exits.

#### Scenario: Daemon receives stop signal
- **WHEN** the foreground daemon receives a supported stop signal
- **THEN** it stops scheduling new tasks
- **AND** it exits after the current task attempt reaches a terminal task-runner result

#### Scenario: Daemon is idle and stop is requested
- **WHEN** the daemon is waiting between scans and receives a supported stop signal
- **THEN** it exits without starting another task

### Requirement: Daemon Preserves Workflow Gates
The daemon SHALL preserve all existing workflow gates enforced by task runner workflows. Automatic scheduling MUST NOT approve Sources, compose Notes, approve Notes, index unapproved Notes, or otherwise bypass explicit user confirmation and QA gates.

#### Scenario: Daemon runs note indexing task for draft note
- **WHEN** the daemon runs a `note.index` task whose target Note is not `approved`
- **THEN** the underlying workflow rejects the task according to existing rules
- **AND** the task attempt records the workflow failure without creating a main index entry

#### Scenario: Daemon runs source understanding without processed artifacts
- **WHEN** the daemon runs a `source.understand` task for a Source that lacks required processed artifacts
- **THEN** the underlying workflow rejects the task according to existing rules
- **AND** the daemon does not synthesize or repair missing artifacts
