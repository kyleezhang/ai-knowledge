# Draft Understanding Specification

## Purpose

This capability defines how the system creates the first structured interpretation of a processed `Source`. Draft understanding is discussion input, not approved knowledge.
## Requirements
### Requirement: Draft Understanding Requires Processed Artifacts
The system SHALL generate `draft_understanding` only from a `Source` that has status `processed` and valid processed artifacts. For Markdown, PDF, and explicit URL Sources, draft understanding MUST consume `processing_artifacts.clean_text`, `processing_artifacts.segments`, and `processing_artifacts.metadata` through workflow-managed storage reads, and MUST NOT depend on input-specific raw files such as `raw/original.pdf` or `raw/fetched.html`.

#### Scenario: Processed source is understood
- **WHEN** a `Source` has status `processed` and valid `processing_artifacts`
- **THEN** the system may generate `draft_understanding`
- **AND** the generated structure is embedded in `source.json`

#### Scenario: Missing processed artifacts
- **WHEN** a workflow requests draft understanding for a `Source` without processed artifacts
- **THEN** the system rejects the request
- **AND** no `draft_understanding` is persisted

#### Scenario: Source is not processed
- **WHEN** a workflow requests draft understanding for a `Source` whose status is not `processed`
- **THEN** the system rejects the request
- **AND** the existing Source status remains unchanged

#### Scenario: PDF or URL source is understood from normalized artifacts
- **WHEN** the workflow generates draft understanding for a processed PDF or URL Source
- **THEN** it reads only the normalized processed artifacts through storage-managed paths
- **AND** the Understand Agent remains agnostic to the original raw input format

### Requirement: Agent Output Is Schema Validated
The system SHALL validate all agent-produced draft understanding before workflow continuation. The Understand Agent MUST produce only semantic candidate fields, and the workflow MUST add system-controlled fields such as `generated_at`.

#### Scenario: Agent returns valid draft understanding
- **WHEN** the agent output satisfies the draft-understanding schema
- **THEN** the workflow may persist it
- **AND** the `Source` may transition to `understanding_ready`

#### Scenario: Agent returns invalid draft understanding
- **WHEN** the agent output fails schema validation
- **THEN** the workflow fails without silently repairing the output
- **AND** the `Source` does not transition to `understanding_ready`

#### Scenario: Workflow adds generation time
- **WHEN** the Understand Agent returns valid semantic draft fields
- **THEN** the workflow adds `generated_at`
- **AND** the model does not control that timestamp

### Requirement: Draft Understanding Is Not Formal Knowledge

The system SHALL treat `draft_understanding` as preliminary discussion material only.

#### Scenario: Note is requested from draft understanding
- **WHEN** a workflow attempts to create a formal `Note` from `draft_understanding` alone
- **THEN** the system rejects the operation
- **AND** requires discussion convergence and explicit user approval first

### Requirement: Draft Understanding Captures Uncertainty
The system SHALL include uncertainty and discussion prompts in generated draft understanding.

#### Scenario: Draft understanding is generated
- **WHEN** the system stores `draft_understanding`
- **THEN** it includes summary, key points, uncertainties, discussion starters, and generation time
- **AND** these fields remain subordinate to later user-confirmed discussion results

#### Scenario: Input is truncated
- **WHEN** the workflow truncates processed artifact input before calling the Understand Agent
- **THEN** the agent input includes `input_truncated = true`
- **AND** the generated uncertainties must reflect that the material may be incomplete

### Requirement: Understand Agent Uses Draft Prompt
The system SHALL use the `draft-understanding.md` prompt when generating `draft_understanding` through the Understand Agent.

#### Scenario: Understand Agent is called
- **WHEN** `ai-knowledge source understand <source_id>` runs for a valid processed Source
- **THEN** the workflow calls the Understand Agent
- **AND** the Agent uses `src/agents/prompts/draft-understanding.md`

### Requirement: Draft Understanding State Transition Is Explicit
The system SHALL transition a Source from `processed` to `understanding_ready` only after a schema-valid `draft_understanding` has been persisted.

#### Scenario: Draft understanding succeeds
- **WHEN** `draft_understanding` is generated and persisted successfully
- **THEN** the Source transitions from `processed` to `understanding_ready`
- **AND** previous `last_error` is cleared
- **AND** the workflow returns next action `ai-knowledge source discuss <source_id>`

### Requirement: Draft Understanding Failure Is Recorded
The system SHALL record understanding-stage failures on the Source when LLM invocation, artifact loading, JSON parsing, or schema validation fails.

#### Scenario: LLM or schema failure occurs
- **WHEN** draft understanding generation fails during the understanding stage
- **THEN** the Source transitions to `failed` when possible
- **AND** `last_error.stage` is `understanding`
- **AND** no `understanding_ready` transition occurs

### Requirement: Source Understand CLI Reports Draft
The system SHALL expose draft understanding generation through `ai-knowledge source understand <source_id>` with human-readable output, `--show`, and `--json`.

#### Scenario: CLI understanding succeeds
- **WHEN** a user runs `ai-knowledge source understand <source_id>` and generation succeeds
- **THEN** the CLI reports that draft understanding is ready
- **AND** the CLI displays next action `ai-knowledge source discuss <source_id>`

#### Scenario: CLI show option is used
- **WHEN** a user runs `ai-knowledge source understand <source_id> --show`
- **THEN** the CLI displays the full `draft_understanding`

#### Scenario: CLI JSON output is requested
- **WHEN** a user runs `ai-knowledge source understand <source_id> --json`
- **THEN** the CLI returns a JSON representation of the workflow result
- **AND** the JSON includes the generated `draft_understanding`

### Requirement: Draft Understanding May Be Labeled Fallback Evidence
The system SHALL allow `draft_understanding` to be used as unconfirmed fallback evidence only when answer fallback is explicitly enabled. Draft understanding MUST remain discussion-stage understanding and MUST NOT be treated as formal knowledge.

#### Scenario: Draft understanding supports fallback
- **WHEN** a Source has relevant `draft_understanding` and fallback is enabled
- **THEN** answer workflow may include it as unconfirmed evidence
- **AND** labels it with `material_type = draft_understanding`

#### Scenario: Draft understanding is used for fallback
- **WHEN** draft understanding is included in answer fallback
- **THEN** no Note is created from it
- **AND** no Source status is changed

### Requirement: Draft Understanding May Run As Local Task
The system SHALL allow draft understanding generation to be enqueued and run as a local task. The task runner MUST call the existing understanding workflow and MUST preserve processed artifact and LLM schema validation gates.

#### Scenario: Understanding task runs
- **WHEN** a `source.understand` task is executed for a processed Source
- **THEN** the runner calls the draft understanding workflow
- **AND** LLM output must pass schema validation before Source state changes

#### Scenario: Understanding task runs too early
- **WHEN** a `source.understand` task targets a Source without processed artifacts
- **THEN** the task attempt records a non-retryable failure
- **AND** no `draft_understanding` is created
