## MODIFIED Requirements

### Requirement: Markdown Renders From Note JSON
The system SHALL render `note.md` from `note.json`. `ai-knowledge note render <note_id>` MUST reload the Note JSON and overwrite the Markdown reading view without changing Note status.

#### Scenario: Note is rendered
- **WHEN** rendering is requested for a valid `Note`
- **THEN** the renderer reads `note.json`
- **AND** writes `note.md` as a derived reading view

#### Scenario: Note is rerendered by CLI
- **WHEN** the user runs `ai-knowledge note render <note_id>`
- **THEN** the system regenerates `note.md` from `note.json`
- **AND** does not alter Note status

### Requirement: Rendered Markdown Follows Template
The system SHALL use the approved note template for rendered Markdown.

#### Scenario: Markdown output is generated
- **WHEN** `note.md` is written
- **THEN** it includes the required note sections defined by the current note schema and template

#### Scenario: Draft Note markdown is generated
- **WHEN** a draft Note is composed
- **THEN** rendered Markdown includes source overview, why it matters, conclusions, current understanding, open questions, related notes, and source links

## ADDED Requirements

### Requirement: Rendering Supports JSON Output
The system SHALL support machine-readable output for note render commands.

#### Scenario: User requests JSON output for render
- **WHEN** the user runs `ai-knowledge note render <note_id> --json`
- **THEN** the CLI returns the render workflow result as JSON
- **AND** the Note status is unchanged
