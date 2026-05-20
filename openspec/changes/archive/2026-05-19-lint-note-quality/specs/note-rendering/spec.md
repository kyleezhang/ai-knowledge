## ADDED Requirements

### Requirement: Note Lint Checks Markdown Template Sections
The system SHALL check rendered `note.md` for required template sections during lint.

#### Scenario: Markdown template is complete
- **WHEN** `note.md` contains all required rendered Note sections
- **THEN** lint marks `quality_checks.template_complete = true`

#### Scenario: Markdown template is incomplete
- **WHEN** `note.md` is missing one or more required rendered Note sections
- **THEN** lint fails
- **AND** records the missing section names in `quality_checks.empty_sections`
