## ADDED Requirements

### Requirement: Discussion Convergence Checker Is Deterministic

The system SHALL provide a deterministic discussion convergence checker that evaluates a `Source` and its `discussion_summary` without calling an Agent, reading external systems, writing files, or mutating Source state.

#### Scenario: Convergence checker accepts a ready discussion
- **WHEN** a Source is in `discussing` status
- **AND** `discussion_summary.ready_for_approval = true`
- **AND** `discussion_summary.confirmed_points` is non-empty
- **AND** `discussion_summary.open_questions` is empty
- **AND** `discussion_summary.unresolved_issues` is empty
- **THEN** the checker returns a passed result
- **AND** the result contains no blocking reasons

#### Scenario: Convergence checker rejects missing confirmed points
- **WHEN** `discussion_summary.confirmed_points` is empty
- **THEN** the checker returns a failed result
- **AND** the result includes a reason identifying missing confirmed points

#### Scenario: Convergence checker rejects open questions
- **WHEN** `discussion_summary.open_questions` is non-empty
- **THEN** the checker returns a failed result
- **AND** the result includes a reason identifying open questions

#### Scenario: Convergence checker rejects unresolved issues
- **WHEN** `discussion_summary.unresolved_issues` is non-empty
- **THEN** the checker returns a failed result
- **AND** the result includes a reason identifying unresolved issues

#### Scenario: Convergence checker rejects non-discussing Source
- **WHEN** the Source status is not `discussing`
- **THEN** the checker returns a failed result
- **AND** the result includes a reason identifying incompatible Source status

### Requirement: Discussion Workflow Normalizes Approval Readiness

The system SHALL run the deterministic convergence checker after applying a discussion summary update. If the checker does not pass, the persisted `discussion_summary.ready_for_approval` MUST be `false` even when the Agent update requested `ready_for_approval = true`.

#### Scenario: Agent marks ready while questions remain
- **WHEN** the Discussion Agent update sets `ready_for_approval = true`
- **AND** the resulting `discussion_summary.open_questions` is non-empty
- **THEN** the discussion workflow persists `ready_for_approval = false`
- **AND** the Source remains in `discussing` status

#### Scenario: Agent marks ready after convergence rules pass
- **WHEN** the Discussion Agent update sets `ready_for_approval = true`
- **AND** the resulting summary passes the convergence checker
- **THEN** the discussion workflow may persist `ready_for_approval = true`
- **AND** the Source remains in `discussing` until explicit user approval

## MODIFIED Requirements

### Requirement: Approval Readiness Is Explicit
The system SHALL expose approval readiness through `discussion_summary.ready_for_approval`, and the discussion REPL MUST NOT force approval when readiness conditions are not met. `ready_for_approval = true` MUST only be persisted when the deterministic convergence checker passes for the current Source and `discussion_summary`.

#### Scenario: Discussion has unresolved questions
- **WHEN** `open_questions` or blocking `unresolved_issues` remain
- **THEN** `ready_for_approval` remains `false`
- **AND** the system does not request final approval as if discussion had converged

#### Scenario: Discussion has confirmed conclusions
- **WHEN** `confirmed_points` is non-empty
- **AND** `open_questions` is empty
- **AND** `unresolved_issues` is empty
- **AND** the Source is in `discussing` status
- **THEN** the deterministic convergence checker may pass
- **AND** the system may set `ready_for_approval` to `true`
- **AND** may ask the user for explicit approval to compose a note

#### Scenario: User tries to approve before readiness
- **WHEN** the user enters `/approve` and `ready_for_approval` is `false`
- **THEN** the REPL explains that discussion has not converged
- **AND** does not transition the Source to `approved_for_note`

#### Scenario: User approves after readiness
- **WHEN** the user enters `/approve` and `ready_for_approval` is `true` with non-empty `confirmed_points`
- **AND** the deterministic convergence checker passes
- **THEN** the REPL reports that the Source is ready for explicit approval
