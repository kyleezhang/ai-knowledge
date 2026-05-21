## MODIFIED Requirements

### Requirement: Approval Readiness Is Explicit
The system SHALL expose approval readiness through `discussion_summary.ready_for_approval`, and the discussion REPL MUST distinguish between the model's readiness suggestion and the user's explicit approval intent.

#### Scenario: Discussion has unresolved questions
- **WHEN** `open_questions` or blocking `unresolved_issues` remain
- **THEN** `ready_for_approval` remains `false`
- **AND** the system does not request final approval as if discussion had converged

#### Scenario: Discussion converges
- **WHEN** confirmed points are sufficient and no blocking questions remain
- **THEN** the system may set `ready_for_approval` to `true`
- **AND** may ask the user for explicit approval to compose a note

#### Scenario: User invokes approve command without confirmed points
- **WHEN** the user enters `/approve` and `confirmed_points` is empty
- **THEN** the REPL refuses to approve
- **AND** explains that discussion still lacks confirmed points

#### Scenario: User invokes approve command before model readiness suggestion
- **WHEN** the user enters `/approve`, `confirmed_points` is non-empty`, and `ready_for_approval` is `false`
- **THEN** the REPL reports that the Source is not yet model-ready
- **AND** explains that explicit user approval may still be used through the approval workflow in this change

#### Scenario: User invokes approve command after readiness
- **WHEN** the user enters `/approve` and `ready_for_approval` is `true` with non-empty `confirmed_points`
- **THEN** the REPL reports that the Source is ready for explicit approval
- **AND** does not force a transition to `approved_for_note` in this change

### Requirement: User Approval Is Required For Note Readiness
The system SHALL require explicit user approval before a `Source` can become `approved_for_note`. Approval MUST only be accepted when the Source is currently `discussing` and `discussion_summary.confirmed_points` is non-empty. `discussion_summary.ready_for_approval` SHALL remain a model-produced suggestion signal, and explicit user approval MAY advance note readiness even when that signal is still `false`.

#### Scenario: User approves converged discussion after model readiness
- **WHEN** `discussion_summary.ready_for_approval` is `true`, `discussion_summary.confirmed_points` is non-empty, and the user explicitly confirms the structured conclusion
- **THEN** the `Source` may transition to `approved_for_note`

#### Scenario: User approves converged discussion before model readiness
- **WHEN** `discussion_summary.ready_for_approval` is `false`, `discussion_summary.confirmed_points` is non-empty, and the user explicitly confirms the structured conclusion
- **THEN** the `Source` may still transition to `approved_for_note`
- **AND** the approval result makes clear that user confirmation overrode the missing model readiness suggestion

#### Scenario: Agent approval without user confirmation
- **WHEN** an agent determines that discussion has converged but the user has not explicitly approved it
- **THEN** the `Source` remains unapproved for note composition

#### Scenario: Discussion has no confirmed points
- **WHEN** the user requests approval and `confirmed_points` is empty
- **THEN** the system rejects approval
- **AND** the Source remains `discussing`

#### Scenario: Force approval is requested
- **WHEN** a caller attempts to force approval without satisfying the confirmed-points and explicit-user-confirmation conditions
- **THEN** the system rejects the operation
- **AND** no formal Note readiness state is created

### Requirement: Discussion Agent Failure Keeps Discussion Active
The system SHALL keep the Source in `discussing` when a single Discussion Agent turn fails, and SHALL record `last_error.stage = discussion`. Recoverable formatting drift between model text and the expected JSON payload MUST be handled before the failure is classified as a discussion-stage agent error.

#### Scenario: Discussion Agent output is recoverable
- **WHEN** the model output is not bare JSON but contains a single recoverable JSON payload that matches the expected schema
- **THEN** the workflow uses the recovered structured payload
- **AND** the discussion turn continues without recording a discussion-stage failure

#### Scenario: Discussion Agent fails after recovery attempts
- **WHEN** the Discussion Agent output cannot be recovered into a schema-valid payload
- **THEN** the Source remains in `discussing`
- **AND** `last_error.stage` is `discussion`
- **AND** the user may continue or retry discussion
