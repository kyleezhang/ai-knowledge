## MODIFIED Requirements

### Requirement: Answers Prefer Approved Notes
The system SHALL prefer approved notes as the primary evidence source for answers. P0 answer workflow MUST use only approved Notes loaded through approved Index Entries.

#### Scenario: Approved notes match question
- **WHEN** the user asks a question and approved notes match it
- **THEN** the answer is grounded primarily in those notes
- **AND** the response identifies the relevant notes or references

#### Scenario: No approved notes match question
- **WHEN** the user asks a question and no approved index entry matches it
- **THEN** the system states that there is no related confirmed knowledge
- **AND** does not call raw Source fallback as if it were approved knowledge

### Requirement: Unapproved Material Is Secondary Evidence
The system SHALL NOT use raw sources, draft understanding, or discussion summaries as secondary evidence in P0 answer workflow.

#### Scenario: Approved notes are insufficient
- **WHEN** approved notes do not sufficiently answer the question
- **THEN** the P0 system reports limitations
- **AND** does not consult raw sources or discussion-stage material

### Requirement: Answers Do Not Invent Unsupported Claims
The system SHALL avoid fabricating conclusions when available knowledge is insufficient.

#### Scenario: Retrieval has insufficient evidence
- **WHEN** neither approved notes nor clearly marked secondary evidence support an answer
- **THEN** the system states that the current knowledge base is insufficient
- **AND** does not present unsupported claims as settled knowledge

#### Scenario: Answer Agent receives approved notes
- **WHEN** the Answer Agent is called in P0
- **THEN** it receives approved Notes as evidence
- **AND** it must not use model background knowledge as project knowledge

### Requirement: Retrieval Uses Main Index As Entry Point
The system SHALL use the main index as the entry point for approved-note retrieval in P0.

#### Scenario: User asks a question
- **WHEN** the answer workflow begins retrieval
- **THEN** it searches keyword and metadata index entries
- **AND** loads approved notes referenced by matching entries

#### Scenario: Top-k retrieval is requested
- **WHEN** the user passes `--top-k <n>`
- **THEN** the answer workflow returns at most that many matching approved Notes to the Answer Agent

### Requirement: Answer Evidence Remains Traceable
The system SHALL keep answer evidence traceable to approved Notes.

#### Scenario: Answer is produced
- **WHEN** the system returns an answer
- **THEN** it includes references to the note objects used as evidence
- **AND** distinguishes approved notes from unavailable unapproved material

## ADDED Requirements

### Requirement: Answer Agent Uses Grounded Prompt
The system SHALL use `answer-grounded.md` when generating grounded answers from approved Notes.

#### Scenario: Answer Agent is called
- **WHEN** approved Note evidence is available for a question
- **THEN** the workflow calls Answer Agent
- **AND** the Agent uses `src/agents/prompts/answer-grounded.md`

### Requirement: Answer CLI Supports JSON And Top-K
The system SHALL expose approved-note answers through `ai-knowledge answer "<question>"` with `--top-k` and `--json` options.

#### Scenario: User requests JSON answer
- **WHEN** the user runs `ai-knowledge answer "<question>" --json`
- **THEN** the CLI returns the answer workflow result as JSON

#### Scenario: User requests top-k
- **WHEN** the user runs `ai-knowledge answer "<question>" --top-k 5`
- **THEN** the retrieval step uses 5 as the maximum number of approved Notes
