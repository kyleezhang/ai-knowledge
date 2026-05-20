# Note Rendering Specification

## Purpose

This capability defines how the system renders a Markdown reading view from formal `Note` JSON without changing the knowledge source of truth.
## Requirements
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

### Requirement: Markdown Is Not Source Of Truth

The system SHALL NOT treat `note.md` as an editable source of formal knowledge.

#### Scenario: Markdown content changes manually
- **WHEN** `note.md` differs from `note.json`
- **THEN** the system continues to treat `note.json` as authoritative
- **AND** does not reverse-parse Markdown into formal knowledge fields

### Requirement: Rendering Does Not Add Unconfirmed Conclusions

The renderer SHALL NOT introduce conclusions that are absent from validated `note.json`.

#### Scenario: Renderer improves prose
- **WHEN** the renderer formats or clarifies Markdown text
- **THEN** it may improve presentation
- **AND** it does not add new claims, decisions, or conclusions beyond `note.json`

### Requirement: Rendering Is Stable

The system SHALL render Markdown with stable structure for the same `note.json` input.

#### Scenario: Note is rerendered
- **WHEN** rendering runs repeatedly for unchanged `note.json`
- **THEN** the Markdown section structure remains consistent
- **AND** rerendering does not alter `note.json`

### Requirement: Rendered Markdown Follows Template
The system SHALL use the approved note template for rendered Markdown.

#### Scenario: Markdown output is generated
- **WHEN** `note.md` is written
- **THEN** it includes the required note sections defined by the current note schema and template

#### Scenario: Draft Note markdown is generated
- **WHEN** a draft Note is composed
- **THEN** rendered Markdown includes source overview, why it matters, conclusions, current understanding, open questions, related notes, and source links

### Requirement: Rendering Supports JSON Output
The system SHALL support machine-readable output for note render commands.

#### Scenario: User requests JSON output for render
- **WHEN** the user runs `ai-knowledge note render <note_id> --json`
- **THEN** the CLI returns the render workflow result as JSON
- **AND** the Note status is unchanged

### Requirement: Note Lint Checks Markdown Template Sections
The system SHALL check rendered `note.md` for required template sections during lint.

#### Scenario: Markdown template is complete
- **WHEN** `note.md` contains all required rendered Note sections
- **THEN** lint marks `quality_checks.template_complete = true`

#### Scenario: Markdown template is incomplete
- **WHEN** `note.md` is missing one or more required rendered Note sections
- **THEN** lint fails
- **AND** records the missing section names in `quality_checks.empty_sections`

