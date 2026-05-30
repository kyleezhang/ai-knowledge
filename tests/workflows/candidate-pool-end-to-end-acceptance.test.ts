import { readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type {
  GroundedAnswer,
  NoteCandidate,
} from '../../src/agents/schemas.js';
import type { AnswerAgentInput } from '../../src/agents/answer-agent.js';
import type { NoteAgentInput } from '../../src/agents/note-agent.js';
import type { CollectedCandidateInput } from '../../src/collectors/types.js';
import { get_candidate } from '../../src/storage/candidate-repo.js';
import { get_index_entry } from '../../src/storage/index-repo.js';
import { get_note } from '../../src/storage/note-repo.js';
import { get_source } from '../../src/storage/source-repo.js';
import { approve_note_workflow } from '../../src/workflows/approve-note-workflow.js';
import { approve_source_workflow } from '../../src/workflows/approve-source-workflow.js';
import { answer_question_workflow } from '../../src/workflows/answer-question-workflow.js';
import { collect_candidates_workflow } from '../../src/workflows/collect-candidates-workflow.js';
import { compose_note_workflow } from '../../src/workflows/compose-note-workflow.js';
import { discuss_source_workflow } from '../../src/workflows/discuss-source-workflow.js';
import { index_note_workflow } from '../../src/workflows/index-note-workflow.js';
import { lint_note_workflow } from '../../src/workflows/lint-note-workflow.js';
import { process_source_workflow } from '../../src/workflows/process-source-workflow.js';
import { select_candidate_workflow } from '../../src/workflows/select-candidate-workflow.js';
import { understand_source_workflow } from '../../src/workflows/understand-source-workflow.js';
import { create_temp_dir } from '../source-test-helpers.js';

const confirmed_point =
  'Candidate pool acceptance keeps collected knowledge behind approved Notes.';
const question = 'candidate pool accepted knowledge';

const collected_candidate: CollectedCandidateInput = {
  source_type: 'github_trending',
  title: 'Candidate Pool AI Agent Research',
  summary:
    'A new AI agent research toolkit with practical tradeoff examples and implementation details for candidate pool acceptance.',
  url: 'https://github.com/example/candidate-pool-ai-agent',
  author: 'example',
  published_at: null,
  tags: ['github-trending', 'ai', 'agent'],
  external_ref: {
    platform: 'github',
    id: 'example/candidate-pool-ai-agent',
    url: 'https://github.com/example/candidate-pool-ai-agent',
    extra: {},
  },
};

describe('Candidate pool end-to-end acceptance', () => {
  it('runs collected Candidate through recommendation, selection, Source, Note, Index, and Answer', async () => {
    const cwd = await create_temp_dir();

    const collect = await collect_candidates_workflow({
      cwd,
      provider: 'github-trending',
      now: new Date('2026-05-29T00:00:00.000Z'),
      collect: async () => ({ ok: true, candidates: [collected_candidate] }),
    });
    expect(collect.ok).toBe(true);
    if (!collect.ok) return;
    const candidate_id = collect.data.candidates[0].id;
    expect(collect.data.candidates[0].status).toBe('recommended');
    expect(collect.data.results[0].status).toBe('created');

    await expect(readdir(`${cwd}/knowledge/index`)).rejects.toThrow();
    await assert_answer_ignores_candidate(cwd);
    await expect(readdir(`${cwd}/knowledge/sources`)).rejects.toThrow();

    const select = await select_candidate_workflow({
      cwd,
      candidate_id,
      now: new Date('2026-05-29T01:00:00.000Z'),
    });
    expect(select.ok).toBe(true);
    if (!select.ok) return;
    const source_id = select.data.source_id;
    await expect(get_candidate(candidate_id, { cwd })).resolves.toMatchObject({
      status: 'converted',
      converted_source_id: source_id,
    });
    await expect(get_source(source_id, { cwd })).resolves.toMatchObject({
      status: 'ingested',
      ingest_type: 'candidate_selected',
      origin_candidate_id: candidate_id,
    });

    const process = await process_source_workflow({
      cwd,
      source_id,
      now: new Date('2026-05-29T02:00:00.000Z'),
    });
    expect(process.ok).toBe(true);
    if (!process.ok) throw new Error(process.error.message);

    const understand = await understand_source_workflow({
      cwd,
      source_id,
      now: new Date('2026-05-29T03:00:00.000Z'),
      understand: async () => ({
        summary: 'Candidate pool source summary.',
        key_points: [confirmed_point],
        uncertainties: [],
        discussion_starters: ['Ready for candidate pool discussion.'],
      }),
    });
    expect(understand.ok).toBe(true);
    if (!understand.ok) throw new Error(understand.error.message);

    const discuss = await discuss_source_workflow({
      cwd,
      source_id,
      user_message: 'Approve candidate pool acceptance.',
      now: new Date('2026-05-29T04:00:00.000Z'),
      discuss: async () => ({
        assistant_message: 'Candidate pool acceptance is ready.',
        discussion_summary_update: {
          confirmed_points: [confirmed_point],
          open_questions: [],
          unresolved_issues: [],
          next_prompts: [],
          ready_for_approval: true,
        },
      }),
    });
    expect(discuss.ok).toBe(true);
    if (!discuss.ok) throw new Error(discuss.error.message);

    const approve_source = await approve_source_workflow({ cwd, source_id });
    expect(approve_source.ok).toBe(true);
    if (!approve_source.ok) throw new Error(approve_source.error.message);

    const compose = await compose_note_workflow({
      cwd,
      source_id,
      now: new Date('2026-05-29T05:00:00.000Z'),
      compose: async ({ agent_input }) => build_note_candidate(agent_input),
    });
    expect(compose.ok).toBe(true);
    if (!compose.ok) throw new Error(compose.error.message);
    const note_id = compose.data.note_id;

    const lint = await lint_note_workflow({
      cwd,
      note_id,
      now: new Date('2026-05-29T06:00:00.000Z'),
    });
    expect(lint.ok).toBe(true);
    if (!lint.ok) throw new Error(lint.error.message);

    const approve_note = await approve_note_workflow({
      cwd,
      note_id,
      now: new Date('2026-05-29T07:00:00.000Z'),
    });
    expect(approve_note.ok).toBe(true);
    if (!approve_note.ok) throw new Error(approve_note.error.message);

    const index = await index_note_workflow({ cwd, note_id });
    expect(index.ok).toBe(true);
    if (!index.ok) throw new Error(index.error.message);
    await expect(get_index_entry(note_id, { cwd })).resolves.toMatchObject({
      note_id,
      status: 'approved',
    });

    let answer_input: AnswerAgentInput | undefined;
    const answer = await answer_question_workflow({
      cwd,
      question,
      answer: async ({ agent_input }) => {
        answer_input = agent_input;
        return build_answer(agent_input);
      },
    });
    expect(answer.ok).toBe(true);
    if (!answer.ok) throw new Error(answer.error.message);
    expect(answer.data.matched_note_ids).toEqual([note_id]);
    expect(answer_input?.approved_notes.map((note) => note.id)).toEqual([
      note_id,
    ]);
    await expect(get_note(note_id, { cwd })).resolves.toMatchObject({
      status: 'approved',
    });
  });

  it('keeps duplicate, dismissed, and unselected Candidates out of Source and Answer', async () => {
    const cwd = await create_temp_dir();
    const collect = await collect_candidates_workflow({
      cwd,
      provider: 'github-trending',
      now: new Date('2026-05-29T00:00:00.000Z'),
      collect: async () => ({
        ok: true,
        candidates: [
          collected_candidate,
          collected_candidate,
          dismissed_candidate(),
        ],
      }),
    });
    expect(collect.ok).toBe(true);
    if (!collect.ok) return;

    expect(collect.data.results.map((result) => result.status)).toEqual([
      'created',
      'duplicate',
      'created',
    ]);
    expect(collect.data.candidates).toHaveLength(2);
    const recommended = collect.data.candidates.find(
      (candidate) => candidate.status === 'recommended',
    );
    const dismissed = collect.data.candidates.find(
      (candidate) => candidate.status === 'dismissed',
    );
    expect(recommended).toBeDefined();
    expect(dismissed).toBeDefined();

    const rejected = await select_candidate_workflow({
      cwd,
      candidate_id: dismissed!.id,
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.error.code).toBe('INVALID_STATE');
    await expect(readdir(`${cwd}/knowledge/sources`)).rejects.toThrow();
    await assert_answer_ignores_candidate(cwd);
  });
});

async function assert_answer_ignores_candidate(cwd: string): Promise<void> {
  let called = false;
  const answer = await answer_question_workflow({
    cwd,
    question,
    answer: async () => {
      called = true;
      throw new Error('should not call');
    },
  });

  expect(answer.ok).toBe(true);
  if (!answer.ok) throw new Error(answer.error.message);
  expect(called).toBe(false);
  expect(answer.data.matched_note_ids).toEqual([]);
  expect(answer.data.answer.conclusion).toBe('没有相关已确认知识。');
}

function build_note_candidate(agent_input: NoteAgentInput): NoteCandidate {
  return {
    title: 'Candidate Pool Acceptance Note',
    conclusions: agent_input.discussion_summary.confirmed_points,
    why_it_matters: [
      'It proves collected Candidates must pass through approved Notes.',
    ],
    current_understanding:
      'Auto-collected Candidates can enter the learning workflow only after recommendation and user selection.',
    open_questions: [],
    related_note_ids: [],
    source_refs: agent_input.source_refs,
  };
}

function build_answer(agent_input: AnswerAgentInput): GroundedAnswer {
  return {
    conclusion: 'The candidate pool answer is grounded in approved Notes.',
    cited_notes: agent_input.approved_notes.map((note) => ({
      note_id: note.id,
      title: note.title,
      relevant_points: note.conclusions,
    })),
    unconfirmed_materials: [],
    limitations: [],
  };
}

function dismissed_candidate(): CollectedCandidateInput {
  return {
    source_type: 'hacker_news',
    title: 'Gardening Weekly',
    summary: 'A long enough article about flowers and soil care.',
    url: 'https://example.com/gardening-weekly',
    author: 'gardener',
    published_at: null,
    tags: ['gardening'],
    external_ref: {
      platform: 'hacker_news',
      id: 'gardening-weekly',
      url: 'https://news.ycombinator.com/item?id=gardening-weekly',
      extra: {},
    },
  };
}
