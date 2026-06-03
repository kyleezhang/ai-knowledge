## ADDED Requirements

### Requirement: Discussion Summary May Be Labeled Fallback Evidence
The system SHALL allow discussion summary to be used as unconfirmed fallback evidence only when answer fallback is explicitly enabled. Discussion summary fallback MUST NOT replace discussion convergence or explicit user approval for formal Note creation.

#### Scenario: Discussion summary supports fallback
- **WHEN** a Source has relevant discussion summary and fallback is enabled
- **THEN** answer workflow may include it as unconfirmed evidence
- **AND** labels it with `material_type = discussion_summary`

#### Scenario: Discussion summary is not approved knowledge
- **WHEN** discussion summary is used in fallback answer
- **THEN** the system does not treat it as an approved Note
- **AND** the Source must still go through approval before Note composition
