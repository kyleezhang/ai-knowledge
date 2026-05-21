## MODIFIED Requirements

### Requirement: LLM Client Exposes Text and JSON Generation
The system SHALL expose a `LlmClient` interface with `generate_text` and `generate_json` operations. `generate_json` MUST accept a Zod schema and MUST return only data that passes that schema. Before classifying a response as `LLM_OUTPUT_PARSE_FAILED`, the client MAY apply a limited recovery step that extracts exactly one structured JSON payload from the model text.

#### Scenario: Text generation succeeds
- **WHEN** an Agent calls `generate_text` with system prompt, user prompt, model, and temperature inputs
- **THEN** the client sends a model request
- **AND** returns the generated text content

#### Scenario: JSON generation succeeds
- **WHEN** an Agent calls `generate_json` and the model returns valid JSON matching the supplied Zod schema
- **THEN** the client returns the parsed typed value

#### Scenario: JSON generation succeeds after fenced recovery
- **WHEN** an Agent calls `generate_json` and the model output is not bare JSON but contains exactly one fenced JSON block matching the supplied Zod schema
- **THEN** the client extracts that fenced JSON payload
- **AND** returns the parsed typed value

#### Scenario: JSON generation succeeds after object extraction
- **WHEN** an Agent calls `generate_json` and the model output is not bare JSON but contains exactly one recoverable top-level JSON object matching the supplied Zod schema
- **THEN** the client extracts that JSON object
- **AND** returns the parsed typed value

#### Scenario: JSON parse fails after recovery attempts
- **WHEN** an Agent calls `generate_json` and the model output cannot be recovered into a single valid JSON payload
- **THEN** the client throws `AgentError`
- **AND** the error code is `LLM_OUTPUT_PARSE_FAILED`

#### Scenario: JSON schema validation fails after recovery
- **WHEN** an Agent calls `generate_json`, recovery produces JSON, and the parsed JSON does not satisfy the supplied Zod schema
- **THEN** the client throws `AgentError`
- **AND** the error code is `LLM_OUTPUT_SCHEMA_FAILED`
