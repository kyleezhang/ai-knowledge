## ADDED Requirements

### Requirement: Processed Artifacts May Support Explicit Answer Fallback
The system SHALL allow processed Source artifacts to support answer fallback only when fallback is explicitly enabled. Processed artifacts used for fallback MUST be labeled unconfirmed and MUST remain separate from approved Note evidence.

#### Scenario: Processed segments support fallback
- **WHEN** a processed Source has relevant processed segments and fallback is enabled
- **THEN** the answer workflow may use those segments as unconfirmed fallback evidence
- **AND** preserves the processed segment locator as `evidence_ref`

#### Scenario: Fallback is not enabled
- **WHEN** a processed Source has relevant artifacts but fallback is not enabled
- **THEN** answer workflow does not use those artifacts

### Requirement: Raw Artifacts Are Not Fallback Answer Evidence
The system SHALL NOT use raw Source artifacts directly as answer fallback evidence.

#### Scenario: Raw artifact matches question
- **WHEN** a Source raw artifact contains text relevant to the question
- **THEN** fallback retrieval does not read it as answer evidence
- **AND** the Source must be processed before structured fallback evidence can be used
