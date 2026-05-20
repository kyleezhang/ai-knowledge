## MODIFIED Requirements

### Requirement: Discussion Binds To One Source
The system SHALL bind each discussion session to a single `Source`. P0 discussion MUST append raw user and assistant messages to that Source's `discussion.jsonl`, and MUST update the corresponding `discussion_summary` in `source.json` through the discussion workflow.

#### Scenario: Discussion starts
- **WHEN** the user starts discussion for a `Source`
- **THEN** discussion messages are appended to that source's `discussion.jsonl`
- **AND** the corresponding `discussion_summary` is updated in `source.json`

#### Scenario: User message is processed
- **WHEN** a user sends a normal message in the discussion REPL
- **THEN** the workflow appends the user message to `discussion.jsonl`
- **AND** the message is associated only with the selected Source

#### Scenario: Agent reply is processed
- **WHEN** the Discussion Agent returns a reply for a user message
- **THEN** the workflow appends the assistant reply to `discussion.jsonl`
- **AND** no other Source discussion log is modified

### Requirement: Discussion Requires Draft Understanding
The system SHALL begin discussion only after draft understanding is available and Source status is `understanding_ready` or `discussing`.

#### Scenario: Discussion requested too early
- **WHEN** a `Source` does not have `draft_understanding`
- **THEN** the system rejects discussion start
- **AND** does not mark the discussion as open

#### Scenario: First discussion turn starts from understanding_ready
- **WHEN** discussion starts for a Source with status `understanding_ready`
- **THEN** the workflow transitions the Source to `discussing`
- **AND** then processes the user message

#### Scenario: Discussion continues from discussing
- **WHEN** discussion continues for a Source with status `discussing`
- **THEN** the workflow processes the user message
- **AND** does not reset existing discussion messages or summary version

### Requirement: Discussion Summary Is Structured
The system SHALL maintain a structured `discussion_summary` for each active discussion. The Discussion Agent SHALL return candidate summary update fields, and the workflow MUST set system-controlled fields including `summary_version`, `discussion_status`, and `last_updated_at`.

#### Scenario: Discussion summary is updated
- **WHEN** a discussion turn is processed
- **THEN** the system updates `discussion_status`, `summary_version`, `confirmed_points`, `open_questions`, `unresolved_issues`, `next_prompts`, `ready_for_approval`, and `last_updated_at`

#### Scenario: Summary version increments
- **WHEN** a discussion turn successfully updates `discussion_summary`
- **THEN** `summary_version` increments by one
- **AND** `last_updated_at` is set by the workflow

#### Scenario: Discussion Agent output is invalid
- **WHEN** Discussion Agent output fails schema validation
- **THEN** the workflow does not update `discussion_summary` from that invalid output
- **AND** records a discussion-stage error

### Requirement: Approval Readiness Is Explicit
The system SHALL expose approval readiness through `discussion_summary.ready_for_approval`, and the discussion REPL MUST NOT force approval when readiness conditions are not met.

#### Scenario: Discussion has unresolved questions
- **WHEN** `open_questions` or blocking `unresolved_issues` remain
- **THEN** `ready_for_approval` remains `false`
- **AND** the system does not request final approval as if discussion had converged

#### Scenario: Discussion converges
- **WHEN** confirmed points are sufficient and no blocking questions remain
- **THEN** the system may set `ready_for_approval` to `true`
- **AND** may ask the user for explicit approval to compose a note

#### Scenario: User invokes approve command before readiness
- **WHEN** the user enters `/approve` and `ready_for_approval` is `false`
- **THEN** the REPL refuses to approve
- **AND** explains the missing readiness condition

#### Scenario: User invokes approve command after readiness
- **WHEN** the user enters `/approve` and `ready_for_approval` is `true` with non-empty `confirmed_points`
- **THEN** the REPL reports that the Source is ready for explicit approval
- **AND** does not force a transition to `approved_for_note` in this change

## ADDED Requirements

### Requirement: Source Discuss CLI Provides Interactive REPL
The system SHALL expose Source discussion through `ai-knowledge source discuss <source_id>` as an interactive REPL.

#### Scenario: REPL starts
- **WHEN** the user runs `ai-knowledge source discuss <source_id>` for a discussable Source
- **THEN** the CLI shows Source context and available built-in commands
- **AND** waits for user input

#### Scenario: User exits REPL
- **WHEN** the user enters `/exit`
- **THEN** the REPL exits without changing approval status

#### Scenario: User asks for help
- **WHEN** the user enters `/help`
- **THEN** the REPL displays available commands

### Requirement: REPL Supports Read-Only Built-In Commands
The discussion REPL SHALL support read-only built-in commands for inspecting current discussion state without calling the Discussion Agent.

#### Scenario: User views summary
- **WHEN** the user enters `/summary`
- **THEN** the REPL displays current `discussion_summary`
- **AND** does not append a user discussion message

#### Scenario: User views draft
- **WHEN** the user enters `/draft`
- **THEN** the REPL displays current `draft_understanding`
- **AND** does not append a user discussion message

#### Scenario: User views status
- **WHEN** the user enters `/status`
- **THEN** the REPL displays Source status and approval readiness
- **AND** does not append a user discussion message

### Requirement: Discussion Agent Failure Keeps Discussion Active
The system SHALL keep the Source in `discussing` when a single Discussion Agent turn fails, and SHALL record `last_error.stage = discussion`.

#### Scenario: Discussion Agent fails
- **WHEN** a user discussion message is appended but the Discussion Agent call fails
- **THEN** the Source remains in `discussing`
- **AND** `last_error.stage` is `discussion`
- **AND** the user may continue or retry discussion

### Requirement: Discussion REPL Requires Human Acceptance Testing
The system SHALL include manual acceptance of the REPL interaction experience for P0.

#### Scenario: Manual REPL acceptance is performed
- **WHEN** the feature is ready for P0 acceptance
- **THEN** a human runs `ai-knowledge source discuss <source_id>` against a fixture Source
- **AND** verifies normal messages, built-in commands, and exit behavior
