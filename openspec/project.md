# AI Knowledge OpenSpec Project

## Purpose

This project implements AI 学习助手, a CLI-first knowledge workflow for AI learning materials.

The system is not a simple summarizer. Its core responsibility is to preserve the boundary between:

- raw material
- processed source artifacts
- draft understanding
- discussion-stage conclusions
- user-approved knowledge
- retrieval and index entries

OpenSpec is the change-control layer for this repository. Any change that affects object contracts, workflow gates, state transitions, knowledge boundaries, CLI behavior, or validation rules must be described in OpenSpec before implementation.

## Product Principle

The central product principle is:

```text
资料进入 -> 处理 -> 初步理解 -> 多轮讨论 -> 用户确认
-> Note JSON -> Markdown -> QA -> 索引 -> 问答
```

Formal knowledge must never be generated directly from raw material or draft understanding.

A `Note` represents user-approved knowledge. A `Source` represents learning work in progress. An `Index Entry` is only a retrieval pointer, not knowledge truth.

## Source Of Truth

The current baseline is defined by:

- `specs/prd.md`
- `specs/workflow.md`
- `specs/schema.md`
- `specs/implementation.md`

OpenSpec changes must preserve or explicitly update this baseline.

If implementation needs conflict with existing specs, update the spec first. Do not make code behavior silently diverge from the documented workflow.

## Scope Discipline

P0 scope is intentionally narrow:

- TypeScript + Node.js + pnpm + ESM
- CLI first
- local filesystem storage
- Markdown import only
- keyword and metadata retrieval only
- mocked agents in tests
- no required real LLM calls in test suites

The following are outside P0 unless a new OpenSpec change explicitly brings them into scope:

- PDF ingestion
- automatic collection
- vector retrieval
- Web UI
- database-backed storage
- external sync
- multi-user collaboration

## Change Levels

### Level 0: Internal Implementation Change

Examples:

- refactoring
- local cleanup
- test-only changes
- implementation detail changes that do not affect behavior

OpenSpec change is optional.

### Level 1: Behavior Change

Examples:

- CLI command behavior
- workflow behavior
- error handling
- QA or lint rules
- answer grounding behavior

OpenSpec change is required.

### Level 2: Contract Change

Examples:

- schema fields
- status enums
- filesystem layout
- object relationships
- state-machine transitions
- storage path rules

OpenSpec change is required. The change must describe compatibility or migration expectations.

### Level 3: Scope Expansion

Examples:

- PDF support
- auto-collection
- vector retrieval
- Web UI
- database replacement

OpenSpec proposal and design are required before implementation.

## Required Workflow Gates

The implementation must preserve these gates:

1. No processed artifacts -> no `draft_understanding`.
2. No discussion convergence + explicit user approval -> no formal `Note`.
3. No `Note JSON` -> no rendered `note.md`.
4. No QA or lint pass -> no `approved` Note.
5. No `approved` Note -> no main index entry.
6. Auto-collected content must become `Candidate` before `Source`.
7. LLM output must pass schema validation before workflow continues.
8. Answers should prefer approved Notes over raw Sources.

These gates are product rules, not implementation preferences.

## Layering Rules

Implementation should follow this dependency direction:

```text
domain -> storage -> processing/agents -> workflows -> cli -> tests
```

Layer responsibilities:

- Domain defines types, schemas, IDs, validation, and state machines.
- Storage resolves paths and reads or writes repository data.
- Agents wrap LLM calls only.
- Workflows compose domain, storage, processors, agents, QA, and state transitions.
- CLI parses arguments, handles interaction, calls workflows, and prints results.

Agents must not write files, mutate statuses, create indexes, or trust their own output without validation.

State transitions must go through domain state-machine helpers.

## Spec Organization

Capability specs should be organized by behavior, not by source file.

Recommended capabilities:

- `source-lifecycle`
- `source-processing`
- `draft-understanding`
- `discussion-convergence`
- `note-lifecycle`
- `note-rendering`
- `note-qa`
- `note-indexing`
- `answer-grounding`

Each capability spec should define:

- observable behavior
- required inputs
- allowed outputs
- workflow gates
- state transitions
- validation requirements
- forbidden shortcuts

## Validation Expectations

Every meaningful OpenSpec change should include a validation path.

At minimum:

```bash
openspec validate --strict
pnpm test
```

When behavior crosses workflow boundaries, add focused tests for:

- domain invariants
- state transitions
- schema validation
- storage paths
- workflow gates
- CLI observable behavior

Tests must not depend on real LLM calls.

## Definition Of Done

A change is complete only when:

- OpenSpec proposal and spec deltas match the intended behavior.
- Tasks are checked off.
- Implementation follows the documented layering rules.
- Required workflow gates are enforced in code.
- Relevant tests pass.
- `openspec validate --strict` passes.
- The change can be archived without leaving undocumented behavior behind.

## Forbidden Shortcuts

Do not:

- generate formal Notes without explicit user approval
- index draft, archived, or superseded Notes as main knowledge
- let `note.md` become editable source of truth
- silently repair invalid LLM JSON and continue
- bypass state-machine helpers
- hand-build knowledge paths outside storage helpers
- add future-phase dependencies before the phase is accepted
- store credentials in repo files
- rewrite raw imported materials to hide processing errors
