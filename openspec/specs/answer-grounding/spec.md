# Answer Grounding Specification

## Purpose

This capability defines how the system answers user questions using approved knowledge first while preserving uncertainty about unapproved material.

## Requirements

### Requirement: Answers Prefer Approved Notes

The system SHALL prefer approved notes as the primary evidence source for answers.

#### Scenario: Approved notes match question
- **WHEN** the user asks a question and approved notes match it
- **THEN** the answer is grounded primarily in those notes
- **AND** the response identifies the relevant notes or references

### Requirement: Unapproved Material Is Secondary Evidence

The system SHALL use raw sources, draft understanding, or discussion summaries only as secondary evidence.

#### Scenario: Approved notes are insufficient
- **WHEN** approved notes do not sufficiently answer the question
- **THEN** the system may consult raw sources or discussion-stage material
- **AND** explicitly marks that material as unapproved or provisional

### Requirement: Answers Do Not Invent Unsupported Claims

The system SHALL avoid fabricating conclusions when available knowledge is insufficient.

#### Scenario: Retrieval has insufficient evidence
- **WHEN** neither approved notes nor clearly marked secondary evidence support an answer
- **THEN** the system states that the current knowledge base is insufficient
- **AND** does not present unsupported claims as settled knowledge

### Requirement: Retrieval Uses Main Index As Entry Point

The system SHALL use the main index as the entry point for approved-note retrieval in P0.

#### Scenario: User asks a question
- **WHEN** the answer workflow begins retrieval
- **THEN** it searches keyword and metadata index entries
- **AND** loads approved notes referenced by matching entries

### Requirement: Answer Evidence Remains Traceable

The system SHALL keep answer evidence traceable to notes or sources.

#### Scenario: Answer is produced
- **WHEN** the system returns an answer
- **THEN** it includes references to the note or source objects used as evidence
- **AND** distinguishes approved notes from unapproved source material
