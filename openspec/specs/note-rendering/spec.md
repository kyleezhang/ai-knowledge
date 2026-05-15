# Note Rendering Specification

## Purpose

This capability defines how the system renders a Markdown reading view from formal `Note` JSON without changing the knowledge source of truth.

## Requirements

### Requirement: Markdown Renders From Note JSON

The system SHALL render `note.md` from `note.json`.

#### Scenario: Note is rendered
- **WHEN** rendering is requested for a valid `Note`
- **THEN** the renderer reads `note.json`
- **AND** writes `note.md` as a derived reading view

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
