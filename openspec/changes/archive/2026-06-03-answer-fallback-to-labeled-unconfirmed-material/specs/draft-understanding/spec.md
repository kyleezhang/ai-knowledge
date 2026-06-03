## ADDED Requirements

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
