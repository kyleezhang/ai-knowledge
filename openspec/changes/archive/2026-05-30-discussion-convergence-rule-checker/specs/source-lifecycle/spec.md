## MODIFIED Requirements

### Requirement: Source Approval Advances To Note Readiness
The system SHALL expose `ai-knowledge source approve <source_id>` to move a converged and explicitly confirmed Source from `discussing` to `approved_for_note`. Approval MUST use the deterministic discussion convergence checker and MUST reject approval when the checker fails.

#### Scenario: Source approval succeeds
- **WHEN** a Source has status `discussing`
- **AND** `discussion_summary.ready_for_approval = true`
- **AND** `discussion_summary.confirmed_points` is non-empty
- **AND** `discussion_summary.open_questions` is empty
- **AND** `discussion_summary.unresolved_issues` is empty
- **AND** the deterministic discussion convergence checker passes
- **THEN** the workflow transitions the Source to `approved_for_note`
- **AND** sets `discussion_summary.discussion_status = closed`
- **AND** returns next action `ai-knowledge note compose <source_id>`

#### Scenario: Source is not discussing
- **WHEN** `ai-knowledge source approve <source_id>` is run for a Source whose status is not `discussing`
- **THEN** the workflow rejects the operation
- **AND** leaves the existing Source status unchanged

#### Scenario: Source approval JSON output is requested
- **WHEN** the user runs `ai-knowledge source approve <source_id> --json`
- **THEN** the CLI returns a JSON representation of the workflow result
- **AND** the JSON includes the approved Source summary and next action

#### Scenario: Convergence checker rejects approval
- **WHEN** `ai-knowledge source approve <source_id>` is run for a Source whose discussion summary does not pass the deterministic convergence checker
- **THEN** the workflow rejects the operation
- **AND** the error includes at least one convergence failure reason
- **AND** leaves the existing Source status unchanged
