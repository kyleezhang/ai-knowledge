## MODIFIED Requirements

### Requirement: User Approval Is Required For Note Readiness
The system SHALL require explicit user approval before a `Source` can become `approved_for_note`. Approval MUST only be accepted when `discussion_summary.ready_for_approval = true`, `discussion_summary.confirmed_points` is non-empty, and the Source is currently `discussing`. The system MUST NOT support force approval.

#### Scenario: User approves converged discussion
- **WHEN** `discussion_summary.ready_for_approval` is `true` and the user explicitly confirms the structured conclusion
- **THEN** the `Source` may transition to `approved_for_note`

#### Scenario: Agent approval without user confirmation
- **WHEN** an agent determines that discussion has converged but the user has not explicitly approved it
- **THEN** the `Source` remains unapproved for note composition

#### Scenario: Discussion is not ready for approval
- **WHEN** the user requests approval and `discussion_summary.ready_for_approval` is `false`
- **THEN** the system rejects approval
- **AND** the Source remains `discussing`

#### Scenario: Discussion has no confirmed points
- **WHEN** the user requests approval and `confirmed_points` is empty
- **THEN** the system rejects approval
- **AND** the Source remains `discussing`

#### Scenario: Force approval is requested
- **WHEN** a caller attempts to force approval without satisfying readiness conditions
- **THEN** the system rejects the operation
- **AND** no formal Note readiness state is created
