# Discussion Convergence Specification

## Purpose

This capability defines how user and agent discussion turns preliminary understanding into a confirmed structure that can be approved for note composition.

## Requirements

### Requirement: Discussion Binds To One Source

The system SHALL bind each discussion session to a single `Source`.

#### Scenario: Discussion starts
- **WHEN** the user starts discussion for a `Source`
- **THEN** discussion messages are appended to that source's `discussion.jsonl`
- **AND** the corresponding `discussion_summary` is updated in `source.json`

### Requirement: Discussion Requires Draft Understanding

The system SHALL begin discussion only after draft understanding is available.

#### Scenario: Discussion requested too early
- **WHEN** a `Source` does not have `draft_understanding`
- **THEN** the system rejects discussion start
- **AND** does not mark the discussion as open

### Requirement: Discussion Summary Is Structured

The system SHALL maintain a structured `discussion_summary` for each active discussion.

#### Scenario: Discussion summary is updated
- **WHEN** a discussion turn is processed
- **THEN** the system updates `discussion_status`, `summary_version`, `confirmed_points`, `open_questions`, `unresolved_issues`, `next_prompts`, `ready_for_approval`, and `last_updated_at`

### Requirement: Approval Readiness Is Explicit

The system SHALL expose approval readiness through `discussion_summary.ready_for_approval`.

#### Scenario: Discussion has unresolved questions
- **WHEN** `open_questions` or blocking `unresolved_issues` remain
- **THEN** `ready_for_approval` remains `false`
- **AND** the system does not request final approval as if discussion had converged

#### Scenario: Discussion converges
- **WHEN** confirmed points are sufficient and no blocking questions remain
- **THEN** the system may set `ready_for_approval` to `true`
- **AND** may ask the user for explicit approval to compose a note

### Requirement: User Approval Is Required For Note Readiness

The system SHALL require explicit user approval before a `Source` can become `approved_for_note`.

#### Scenario: User approves converged discussion
- **WHEN** `discussion_summary.ready_for_approval` is `true` and the user explicitly confirms the structured conclusion
- **THEN** the `Source` may transition to `approved_for_note`

#### Scenario: Agent approval without user confirmation
- **WHEN** an agent determines that discussion has converged but the user has not explicitly approved it
- **THEN** the `Source` remains unapproved for note composition
