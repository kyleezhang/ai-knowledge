# Note Lifecycle Specification

## Purpose

This capability defines how formal knowledge notes are composed, approved, archived, and related back to their source material.

## Requirements

### Requirement: Note Composition Requires Approved Source

The system SHALL compose a formal `Note` only from a `Source` with status `approved_for_note`.

#### Scenario: Approved source composes note
- **WHEN** a `Source` has status `approved_for_note`
- **THEN** the note-composition workflow may create a `Note`
- **AND** the `Source` may record the new `note_id`

#### Scenario: Unapproved source composes note
- **WHEN** a `Source` is not `approved_for_note`
- **THEN** the system rejects formal note composition
- **AND** no `note.json` or `note.md` is created

### Requirement: Note JSON Is Created Before Markdown

The system SHALL create `note.json` as the formal knowledge source of truth before rendering `note.md`.

#### Scenario: Note is composed
- **WHEN** note composition succeeds
- **THEN** the system persists validated `note.json`
- **AND** only then renders `note.md` from `note.json`

### Requirement: New Notes Start As Draft

The system SHALL create newly composed notes with status `draft`.

#### Scenario: New note is saved
- **WHEN** a `Note` is first composed
- **THEN** its status is `draft`
- **AND** it is not eligible for main indexing until approval

### Requirement: Note Approval Requires QA

The system SHALL approve a `Note` only after required QA or lint checks pass.

#### Scenario: Draft note passes QA
- **WHEN** a `draft` Note passes required QA checks
- **THEN** it may transition to `approved`
- **AND** it becomes eligible for main indexing

#### Scenario: Draft note fails QA
- **WHEN** a `draft` Note fails required QA checks
- **THEN** it remains unapproved
- **AND** the system reports the blocking issues

### Requirement: Noncurrent Notes Are Preserved But Not Primary

The system SHALL preserve `archived` and `superseded` notes while excluding them from the current main knowledge layer.

#### Scenario: Note is archived or superseded
- **WHEN** a `Note` transitions to `archived` or `superseded`
- **THEN** it remains stored for traceability
- **AND** it is not treated as the current approved note for indexing or answer grounding
