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
- P0 Stable supports Markdown active import and default approved-Note keyword / metadata retrieval only
- P1 Beta covers PDF, explicit public URL, and single Feishu document ingestion
- P2 Experimental covers Candidate auto-collection, scoring, selection, and local scheduling
- P3 Experimental covers vector indexing and hybrid retrieval

## Capability Phase Map

| Phase | Stability    | Capabilities                                                                                                                                                                       |
| ----- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0    | Stable       | Markdown active import, Source processing, draft understanding, discussion approval, Note compose/render/lint/approve/index, default keyword / metadata answer from approved Notes |
| P1    | Beta         | PDF ingestion, explicit public URL ingestion, single Feishu document ingestion                                                                                                     |
| P2    | Experimental | Candidate collection from GitHub Trending / Hacker News, Candidate scoring/selection, local schedules and task automation                                                          |
| P3    | Experimental | `note index --vector`, vector index metadata, `answer --hybrid`                                                                                                                    |

Beta and Experimental capabilities must not relax the core gates below. They still flow through `Source -> Discussion -> Note -> QA -> Index`, and default `answer` remains grounded in approved Notes only. Unconfirmed fallback requires explicit opt-in and clear labeling.

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

## CLI Capability Labels

P0 Stable commands are the required baseline. P1/P2/P3 commands may be present in the CLI, but must be documented and treated as Beta or Experimental rather than as P0 gates.

## P0 Stable Commands

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

## Extended Commands

```bash
# P1 Beta
ai-knowledge source ingest pdf <file>
ai-knowledge source ingest url <public_url>
ai-knowledge source ingest feishu-doc <doc_url_or_token>

# P2 Experimental
ai-knowledge candidate collect github-trending
ai-knowledge candidate collect hacker-news
ai-knowledge candidate score <candidate_id>
ai-knowledge candidate select <candidate_id>
ai-knowledge candidate list
ai-knowledge candidate show <candidate_id>
ai-knowledge schedule ...
ai-knowledge task ...

# P3 Experimental
ai-knowledge note index <note_id> --vector
ai-knowledge answer "<question>" --hybrid
```

`ai-knowledge answer "<question>" --fallback-unconfirmed` is an explicit non-default fallback path. It may use structured unconfirmed materials only as labeled secondary evidence and must not mutate Candidate, Source, Note, or Index state.

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
