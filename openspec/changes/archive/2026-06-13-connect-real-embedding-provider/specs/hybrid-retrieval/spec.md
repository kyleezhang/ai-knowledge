## MODIFIED Requirements

### Requirement: Vector Signal Is Optional In Hybrid Retrieval
The system SHALL treat vector retrieval as an optional signal. If query embedding provider configuration, query embedding generation, or vector index loading is unavailable, hybrid retrieval MUST continue with keyword and metadata signals and expose the vector-unavailable reason in debug output.

#### Scenario: Query embedding provider is configured
- **WHEN** hybrid retrieval is called with vector-capable configuration and no fake embedding provider is injected
- **THEN** the retrieval layer may resolve the configured embedding provider through the agent layer
- **AND** use it to generate a query embedding for vector scoring

#### Scenario: Query embedding provider config is missing
- **WHEN** hybrid retrieval cannot resolve a usable embedding provider configuration
- **THEN** vector signal is omitted from scoring
- **AND** keyword and metadata retrieval may still return approved Notes
- **AND** debug output records the provider configuration or environment variable reason when requested

#### Scenario: Query embedding provider fails
- **WHEN** hybrid retrieval cannot generate a query embedding
- **THEN** vector signal is omitted from scoring
- **AND** keyword and metadata retrieval may still return approved Notes

#### Scenario: Candidate has no vector_ref
- **WHEN** a matching approved Index Entry has `vector_ref = null`
- **THEN** hybrid retrieval scores keyword and metadata signals for that candidate
- **AND** records that vector signal is unavailable for that candidate when debug output is requested

#### Scenario: Vector dimensions mismatch
- **WHEN** a vector index has dimensions incompatible with the query embedding
- **THEN** hybrid retrieval omits the vector signal for that index
- **AND** does not fail the entire retrieval request

### Requirement: Hybrid Retrieval Uses Approved Main Index As Candidate Boundary
The system SHALL start hybrid retrieval from approved main Index Entries. Hybrid retrieval MUST NOT return draft, archived, superseded, missing, or unloadable Notes. Configured embedding provider usage MUST NOT expand the candidate boundary beyond approved main Index Entries.

#### Scenario: Approved index entry is matched
- **WHEN** an approved Index Entry matches hybrid retrieval
- **THEN** the workflow may load the corresponding approved `note.json`
- **AND** include it as a candidate result

#### Scenario: Query embedding matches stale vector data
- **WHEN** a configured embedding provider returns a query embedding and stale vector data exists for an archived or superseded Note
- **THEN** hybrid retrieval excludes that hit from main results
- **AND** does not use vector metadata to answer from that Note

#### Scenario: Indexed Note is no longer approved
- **WHEN** a matching Index Entry points to a Note whose status is not `approved`
- **THEN** hybrid retrieval skips that Note
- **AND** does not return it through keyword, metadata, or vector signals
