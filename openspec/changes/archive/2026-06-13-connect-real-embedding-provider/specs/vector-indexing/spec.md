## MODIFIED Requirements

### Requirement: Embedding Provider Is Isolated From Persistence
The system SHALL keep embedding model calls in the agent layer and persistence in workflow/storage layers. Embedding providers MUST NOT write files, mutate Note statuses, or create index entries directly. When a workflow needs embeddings and no test provider is injected, it MAY construct a configured real embedding provider through the agent config module.

#### Scenario: Embedding provider returns vectors
- **WHEN** the workflow sends chunk text to the embedding provider
- **THEN** the provider returns vectors and model metadata only
- **AND** the workflow validates and persists the vector index through storage helpers

#### Scenario: Configured embedding provider is used
- **WHEN** `note index --vector` is requested and the workflow caller did not inject a fake provider
- **THEN** the workflow resolves the configured embedding provider in the agent layer
- **AND** uses it only to generate embeddings and metadata
- **AND** all file writes and index entry updates remain in workflow/storage layers

#### Scenario: Embedding provider attempts persistence
- **WHEN** embedding functionality is implemented
- **THEN** file writes and status changes are outside the provider boundary
- **AND** tests can replace the provider with a mocked implementation

### Requirement: Vector Index Build Fails Explicitly
The system SHALL fail vector index construction explicitly when required vector data cannot be validated. Provider configuration failures, missing provider API keys, provider call failures, empty chunk sets, vector count mismatches, and dimension mismatches MUST NOT produce a main-retrievable vector index.

#### Scenario: Provider config is missing
- **WHEN** vector indexing is explicitly requested with `--vector` and no usable embedding provider configuration exists
- **THEN** the vector indexing workflow reports failure
- **AND** the error identifies the missing provider configuration or environment variable without exposing secret values
- **AND** no new `vector_ref` is written

#### Scenario: Provider fails
- **WHEN** the embedding provider fails while building a vector index
- **THEN** the vector indexing workflow reports failure
- **AND** no new main vector index entry is created

#### Scenario: Vector count mismatch
- **WHEN** the provider returns a different number of vectors than requested chunks
- **THEN** the vector indexing workflow rejects the result
- **AND** no `vector_ref` is updated to point at the invalid result

#### Scenario: Embedding dimensions mismatch
- **WHEN** an embedding provider returns vectors with inconsistent dimensions or dimensions different from the declared `embedding_dimensions`
- **THEN** the system rejects the vector index result
- **AND** does not update the Note Index Entry to point at that vector index

#### Scenario: Keyword-only indexing runs without provider config
- **WHEN** `note index <note_id>` is run without `--vector`
- **THEN** the workflow does not require embedding provider configuration
- **AND** it may create or update the keyword / metadata index entry with `vector_ref = null`

### Requirement: Vector Index Records Embedding Contract
The system SHALL persist enough metadata for each vector index to validate embedding compatibility. A vector index MUST include `note_id`, `index_id`, `embedding_model`, `embedding_dimensions`, `chunker_version`, `created_at`, and chunk records containing `chunk_id`, `source_field`, `content_hash`, `text`, and `embedding`. The `embedding_model` and `embedding_dimensions` MUST come from the validated provider result or resolved provider config.

#### Scenario: Vector index is persisted
- **WHEN** vector indexing succeeds for an approved Note
- **THEN** the persisted vector index includes model, dimension, chunking, timestamp, and chunk traceability metadata
- **AND** every embedding vector length equals `embedding_dimensions`

#### Scenario: Provider model metadata is returned
- **WHEN** the embedding provider returns vectors and model metadata
- **THEN** the workflow records the model name in `embedding_model`
- **AND** records the validated vector length in `embedding_dimensions`
