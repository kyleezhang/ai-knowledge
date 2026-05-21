## MODIFIED Requirements

### Requirement: Source Approval Advances To Note Readiness
The system SHALL expose `ai-knowledge source approve <source_id>` to move a converged and explicitly confirmed Source from `discussing` to `approved_for_note`.

#### Scenario: Source approval succeeds after model readiness
- **WHEN** a Source has status `discussing`
- **AND** `discussion_summary.ready_for_approval = true`
- **AND** `discussion_summary.confirmed_points` is non-empty
- **THEN** the workflow transitions the Source to `approved_for_note`
- **AND** sets `discussion_summary.discussion_status = closed`
- **AND** returns next action `ai-knowledge note compose <source_id>`

#### Scenario: Source approval succeeds through explicit user confirmation
- **WHEN** a Source has status `discussing`
- **AND** `discussion_summary.ready_for_approval = false`
- **AND** `discussion_summary.confirmed_points` is non-empty
- **AND** the user explicitly invokes the approval command
- **THEN** the workflow may still transition the Source to `approved_for_note`
- **AND** sets `discussion_summary.discussion_status = closed`
- **AND** returns next action `ai-knowledge note compose <source_id>`

#### Scenario: Source is not discussing
- **WHEN** `ai-knowledge source approve <source_id>` is run for a Source whose status is not `discussing`
- **THEN** the workflow rejects the operation
- **AND** leaves the existing Source status unchanged

#### Scenario: Source approval lacks confirmed points
- **WHEN** `ai-knowledge source approve <source_id>` is run for a Source whose `discussion_summary.confirmed_points` is empty
- **THEN** the workflow rejects the operation
- **AND** explains that discussion still lacks confirmed points

#### Scenario: Source approval JSON output is requested
- **WHEN** the user runs `ai-knowledge source approve <source_id> --json`
- **THEN** the CLI returns a JSON representation of the workflow result
- **AND** the JSON includes the approved Source summary and next action
