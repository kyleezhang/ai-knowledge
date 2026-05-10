# AGENTS.md

## Purpose

This repo implements **AI 学习助手**: a CLI-first knowledge workflow for AI learning materials.

Core flow:

```text
资料进入 -> 处理 -> 初步理解 -> 多轮讨论 -> 用户确认
-> Note JSON -> Markdown -> QA -> 索引 -> 问答
```

This is not a simple summarizer. Always preserve the boundary between raw material, discussion-stage understanding, and user-approved knowledge.

## Source of Truth

Read the relevant specs before changing behavior:

- `specs/prd.md` — product requirements
- `specs/workflow.md` — workflow and state semantics
- `specs/schema.md` — object schemas and filesystem layout
- `specs/implementation.md` — technical standards and phase plan

If implementation needs conflict with specs, update the spec first.

## Technical Baseline

- TypeScript + Node.js LTS + pnpm + ESM
- CLI first; no Web UI in P0
- Local filesystem storage under `knowledge/`
- Zod for runtime validation
- Vitest for tests
- ESLint + Prettier for quality
- `snake_case` for JSON fields and core TypeScript object fields
- P0 supports Markdown only
- P0 retrieval is keyword / metadata only
- PDF is P1, auto-collection is P2, vector retrieval is P3

## Core Object Rules

- `Candidate`: auto-collected candidate only; not main knowledge.
- `Source`: ingestion, processing, draft understanding, discussion, approval.
- `Note`: approved knowledge object.
- `note.json`: source of truth for formal knowledge.
- `note.md`: rendered reading view only.
- `Index Entry`: retrieval entry only, not knowledge truth.

Do not generate a formal `Note` directly from raw material or `draft_understanding`.

## Filesystem Rules

MVP layout:

```text
knowledge/
  candidates/
  sources/
  notes/
  index/
```

Follow `specs/schema.md` exactly.

Do not hand-build `knowledge/` paths outside storage path helpers.

## Layering Rules

- CLI: parse args, handle user interaction, call workflows, print results.
- Domain: types, Zod schemas, state enums, IDs, validators, state machine.
- Storage: path resolution, JSON read/write, directories, raw/processed artifacts, `discussion.jsonl`.
- Workflow: compose storage + domain + processors + agents + QA + state transitions.
- Agent: wrap LLM calls only.

Agents must not write files, mutate statuses, create indexes, or trust their own output without validation.

State transitions must go through domain state-machine helpers, never direct status assignment.

## Agent Workflow

When implementing work:

1. Read the relevant spec.
2. Identify the affected layer.
3. Implement from inside out:

```text
domain -> storage -> processing/agents -> workflows -> cli -> tests
```

4. Validate before and after state transitions.
5. Add tests at the changed boundary.
6. If the request crosses P0 scope, update specs first.

## Required Gates

Never bypass these gates:

1. No processed artifacts -> no `draft_understanding`.
2. No discussion convergence + explicit user approval -> no formal `Note`.
3. No QA / lint pass -> no `approved` Note.
4. No `approved` Note -> no main index entry.
5. Auto-collected content must become `Candidate` before `Source`.
6. LLM output must pass schema validation before workflow continues.
7. Answers should prefer approved Notes over raw Sources.

## Do Not Do

Unless specs are updated first, do not:

- Add PDF, auto-collection, or vector retrieval to P0.
- Introduce a database to replace local filesystem storage.
- Build Web UI before the CLI workflow is complete.
- Let `note.md` become editable source of truth.
- Generate formal Notes without explicit user approval.
- Index draft, archived, or superseded Notes as main knowledge.
- Silently repair invalid LLM JSON and continue.
- Mix camelCase and snake_case in core object fields.
- Add dependencies for future phases before needed.
- Store API keys, tokens, cookies, or credentials in repo files.
- Delete or rewrite raw imported materials to hide processing errors.

## P0 Commands

```bash
ai-knowledge source ingest markdown <file>
ai-knowledge source process <source_id>
ai-knowledge source understand <source_id>
ai-knowledge source discuss <source_id>
ai-knowledge source approve <source_id>
ai-knowledge source list
ai-knowledge source show <source_id>

ai-knowledge note compose <source_id>
ai-knowledge note render <note_id>
ai-knowledge note lint <note_id>
ai-knowledge note approve <note_id>
ai-knowledge note index <note_id>
ai-knowledge note list
ai-knowledge note show <note_id>

ai-knowledge answer "<question>"
```

## Testing

Use Vitest. Prioritize tests for:

- ID / slug generation
- state transitions
- validators
- path generation
- markdown rendering
- note lint
- P0 workflow with mocked agents

Tests must not depend on real LLM calls.

## Implementation Discipline

Keep changes scoped. Do not introduce speculative abstractions. Prefer updating specs before changing object contracts.
