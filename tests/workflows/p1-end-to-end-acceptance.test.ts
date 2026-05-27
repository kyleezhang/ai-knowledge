import { access, readFile, readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type {
  GroundedAnswer,
  NoteCandidate,
} from '../../src/agents/schemas.js';
import type { AnswerAgentInput } from '../../src/agents/answer-agent.js';
import type { NoteAgentInput } from '../../src/agents/note-agent.js';
import type { DocumentProcessingResult } from '../../src/processing/document-processor.js';
import { get_index_entry } from '../../src/storage/index-repo.js';
import { get_note } from '../../src/storage/note-repo.js';
import {
  index_entry_path,
  note_json_path,
  note_markdown_path,
  source_json_path,
  source_processed_dir,
  source_raw_html_path,
  source_raw_pdf_path,
} from '../../src/storage/paths.js';
import { get_source } from '../../src/storage/source-repo.js';
import { approve_note_workflow } from '../../src/workflows/approve-note-workflow.js';
import { approve_source_workflow } from '../../src/workflows/approve-source-workflow.js';
import { answer_question_workflow } from '../../src/workflows/answer-question-workflow.js';
import { compose_note_workflow } from '../../src/workflows/compose-note-workflow.js';
import { discuss_source_workflow } from '../../src/workflows/discuss-source-workflow.js';
import { index_note_workflow } from '../../src/workflows/index-note-workflow.js';
import { ingest_pdf_workflow } from '../../src/workflows/ingest-pdf-workflow.js';
import { ingest_url_workflow } from '../../src/workflows/ingest-url-workflow.js';
import { lint_note_workflow } from '../../src/workflows/lint-note-workflow.js';
import { process_source_workflow } from '../../src/workflows/process-source-workflow.js';
import { understand_source_workflow } from '../../src/workflows/understand-source-workflow.js';
import { create_temp_dir, write_pdf_fixture } from '../source-test-helpers.js';

const pdf_question = 'p1 pdf locator approved notes';
const url_question = 'p1 url locator approved notes';
const pdf_confirmed_point = 'PDF acceptance keeps source evidence traceable.';
const url_confirmed_point = 'URL acceptance keeps source evidence traceable.';
const deterministic_html =
  '<html><head><title>P1 URL Acceptance</title></head><body><article><h1>P1 URL Acceptance</h1><p>URL body with stable evidence.</p></article></body></html>';

const pdf_processed: DocumentProcessingResult = {
  clean_text: '## Page 1\n\nPDF acceptance body.\n',
  segments: [
    {
      id: 'seg_0001',
      order: 1,
      heading_path: ['Page 1'],
      text: 'PDF acceptance body.',
      locator: {
        ref: 'processed/segments.json#seg_0001',
        source_kind: 'pdf',
        position: 1,
        page: 1,
        heading_path: ['Page 1'],
      },
    },
  ],
  metadata: {
    title: 'P1 PDF Acceptance',
    headings: [{ level: 2, title: 'Page 1' }],
    links: [],
    segment_count: 1,
    processed_at: '2026-05-26T01:00:00.000Z',
    page_count: 1,
  },
};

const url_processed: DocumentProcessingResult = {
  clean_text: '# P1 URL Acceptance\n\nURL body with stable evidence.\n',
  segments: [
    {
      id: 'seg_0001',
      order: 1,
      heading_path: ['P1 URL Acceptance'],
      text: 'URL body with stable evidence.',
      locator: {
        ref: 'processed/segments.json#seg_0001',
        source_kind: 'url',
        position: 1,
        heading_path: ['P1 URL Acceptance'],
        section: 'p1-url-acceptance',
      },
    },
  ],
  metadata: {
    title: 'P1 URL Acceptance',
    headings: [{ level: 1, title: 'P1 URL Acceptance' }],
    links: [],
    segment_count: 1,
    processed_at: '2026-05-26T01:10:00.000Z',
    source_url: 'https://example.com/p1-url-acceptance',
  },
};

type AcceptanceKind = 'pdf' | 'url';

type AcceptanceRun = {
  source_id: string;
  note_id: string;
  answer_input: AnswerAgentInput | undefined;
};

describe('P1 PDF and URL end-to-end acceptance', () => {
  it('runs the full PDF happy path from an empty knowledge directory to answer', async () => {
    const cwd = await create_temp_dir();
    const file_path = await write_pdf_fixture(cwd, 'p1-pdf-acceptance.pdf');

    const result = await run_acceptance_flow({
      kind: 'pdf',
      cwd,
      ingest: async () => {
        const ingest = await ingest_pdf_workflow({
          file_path,
          cwd,
          now: new Date('2026-05-26T00:00:00.000Z'),
        });
        if (!ingest.ok) throw new Error(ingest.error.message);
        return ingest.data.source_id;
      },
      process: async (source_id) =>
        process_source_workflow({
          cwd,
          source_id,
          now: new Date('2026-05-26T01:00:00.000Z'),
          process_pdf: async () => pdf_processed,
        }),
      confirmed_point: pdf_confirmed_point,
      question: pdf_question,
    });

    await assert_common_artifacts(cwd, result.source_id, result.note_id);
    await expect(
      access(source_raw_pdf_path(result.source_id, { cwd })),
    ).resolves.toBeUndefined();
    const segments = JSON.parse(
      await readFile(
        `${source_processed_dir(result.source_id, { cwd })}/segments.json`,
        'utf8',
      ),
    ) as typeof pdf_processed.segments;
    expect(segments[0].locator).toEqual(pdf_processed.segments[0].locator);
    expect(result.answer_input?.approved_notes.map((note) => note.id)).toEqual([
      result.note_id,
    ]);
  });

  it('runs the full URL happy path from an empty knowledge directory to answer', async () => {
    const cwd = await create_temp_dir();

    const result = await run_acceptance_flow({
      kind: 'url',
      cwd,
      ingest: async () => {
        const ingest = await ingest_url_workflow({
          url: 'https://example.com/p1-url-acceptance',
          cwd,
          now: new Date('2026-05-26T00:10:00.000Z'),
          fetch_html: async () => deterministic_html,
        });
        if (!ingest.ok) throw new Error(ingest.error.message);
        return ingest.data.source_id;
      },
      process: async (source_id) =>
        process_source_workflow({
          cwd,
          source_id,
          now: new Date('2026-05-26T01:10:00.000Z'),
          process_url: () => url_processed,
        }),
      confirmed_point: url_confirmed_point,
      question: url_question,
    });

    await assert_common_artifacts(cwd, result.source_id, result.note_id);
    await expect(
      access(source_raw_html_path(result.source_id, { cwd })),
    ).resolves.toBeUndefined();
    await expect(
      readFile(source_raw_html_path(result.source_id, { cwd }), 'utf8'),
    ).resolves.toBe(deterministic_html);
    const segments = JSON.parse(
      await readFile(
        `${source_processed_dir(result.source_id, { cwd })}/segments.json`,
        'utf8',
      ),
    ) as typeof url_processed.segments;
    expect(segments[0].locator).toEqual(url_processed.segments[0].locator);
    expect(result.answer_input?.approved_notes.map((note) => note.id)).toEqual([
      result.note_id,
    ]);
  });

  it('reports URL fetch and unsupported content-type failures without creating Sources', async () => {
    const fetch_failure_cwd = await create_temp_dir();
    const fetch_failure = await ingest_url_workflow({
      url: 'https://example.com/fetch-failure',
      cwd: fetch_failure_cwd,
      fetch_html: async () => {
        throw new Error('network unavailable');
      },
    });

    expect(fetch_failure.ok).toBe(false);
    if (!fetch_failure.ok) {
      expect(fetch_failure.error.code).toBe('INVALID_INPUT');
      expect(fetch_failure.error.message).toContain('could not be fetched');
    }
    await expect(
      readdir(`${fetch_failure_cwd}/knowledge/sources`),
    ).rejects.toThrow();

    const content_type_cwd = await create_temp_dir();
    const response = new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
    Object.defineProperty(response, 'url', {
      value: 'https://example.com/not-html.json',
    });
    const original_fetch = globalThis.fetch;
    globalThis.fetch = async () => response;
    try {
      const unsupported = await ingest_url_workflow({
        url: 'https://example.com/not-html.json',
        cwd: content_type_cwd,
      });
      expect(unsupported.ok).toBe(false);
      if (!unsupported.ok) {
        expect(unsupported.error.code).toBe('INVALID_INPUT');
        expect(unsupported.error.message).toContain('could not be fetched');
      }
      await expect(
        readdir(`${content_type_cwd}/knowledge/sources`),
      ).rejects.toThrow();
    } finally {
      globalThis.fetch = original_fetch;
    }
  });

  it('reports PDF extraction failure and preserves the raw PDF', async () => {
    const cwd = await create_temp_dir();
    const file_path = await write_pdf_fixture(cwd, 'broken.pdf');
    const ingest = await ingest_pdf_workflow({
      file_path,
      cwd,
      now: new Date('2026-05-26T00:00:00.000Z'),
    });
    if (!ingest.ok) throw new Error(ingest.error.message);

    const result = await process_source_workflow({
      cwd,
      source_id: ingest.data.source_id,
      now: new Date('2026-05-26T01:00:00.000Z'),
      process_pdf: async () => {
        throw new Error('PDF processing produced no extractable text.');
      },
    });
    const source = await get_source(ingest.data.source_id, { cwd });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PROCESSING_FAILED');
      expect(result.error.message).toContain(
        'PDF processing produced no extractable text',
      );
    }
    expect(source.status).toBe('failed');
    expect(source.last_error?.stage).toBe('processing');
    await expect(
      access(source_raw_pdf_path(ingest.data.source_id, { cwd })),
    ).resolves.toBeUndefined();
  });
});

async function run_acceptance_flow(input: {
  kind: AcceptanceKind;
  cwd: string;
  ingest: () => Promise<string>;
  process: (source_id: string) => ReturnType<typeof process_source_workflow>;
  confirmed_point: string;
  question: string;
}): Promise<AcceptanceRun> {
  const source_id = await input.ingest();

  const process = await input.process(source_id);
  expect(process.ok).toBe(true);
  if (!process.ok) throw new Error(process.error.message);

  const understand = await understand_source_workflow({
    cwd: input.cwd,
    source_id,
    now: new Date('2026-05-26T02:00:00.000Z'),
    understand: async ({ agent_input }) => ({
      summary: `${input.kind.toUpperCase()} summary for ${agent_input.source_title}`,
      key_points: [input.confirmed_point],
      uncertainties: [],
      discussion_starters: ['Ready for discussion.'],
    }),
  });
  expect(understand.ok).toBe(true);
  if (!understand.ok) throw new Error(understand.error.message);

  const blocked_compose = await compose_note_workflow({
    cwd: input.cwd,
    source_id,
  });
  expect(blocked_compose.ok).toBe(false);
  if (blocked_compose.ok)
    throw new Error('note compose should have been blocked');
  expect(blocked_compose.error.code).toBe('INVALID_INPUT');

  const discuss = await discuss_source_workflow({
    cwd: input.cwd,
    source_id,
    user_message: `Approve ${input.kind} acceptance.`,
    now: new Date('2026-05-26T03:00:00.000Z'),
    discuss: async () => ({
      assistant_message: `${input.kind} acceptance ready.`,
      discussion_summary_update: {
        confirmed_points: [input.confirmed_point],
        open_questions: [],
        unresolved_issues: [],
        next_prompts: [],
        ready_for_approval: true,
      },
    }),
  });
  expect(discuss.ok).toBe(true);
  if (!discuss.ok) throw new Error(discuss.error.message);

  const approve_source = await approve_source_workflow({
    cwd: input.cwd,
    source_id,
  });
  expect(approve_source.ok).toBe(true);
  if (!approve_source.ok) throw new Error(approve_source.error.message);

  const compose = await compose_note_workflow({
    cwd: input.cwd,
    source_id,
    now: new Date('2026-05-26T04:00:00.000Z'),
    compose: async ({ agent_input }) => build_note_candidate(agent_input),
  });
  expect(compose.ok).toBe(true);
  if (!compose.ok) throw new Error(compose.error.message);
  const note_id = compose.data.note_id;

  const blocked_approve = await approve_note_workflow({
    cwd: input.cwd,
    note_id,
  });
  expect(blocked_approve.ok).toBe(false);
  if (blocked_approve.ok)
    throw new Error('note approve should have been blocked');
  expect(blocked_approve.error.code).toBe('INVALID_STATE');

  const lint = await lint_note_workflow({
    cwd: input.cwd,
    note_id,
    now: new Date('2026-05-26T05:00:00.000Z'),
  });
  expect(lint.ok).toBe(true);
  if (!lint.ok) throw new Error(lint.error.message);

  const approve_note = await approve_note_workflow({
    cwd: input.cwd,
    note_id,
    now: new Date('2026-05-26T06:00:00.000Z'),
  });
  expect(approve_note.ok).toBe(true);
  if (!approve_note.ok) throw new Error(approve_note.error.message);

  const index = await index_note_workflow({ cwd: input.cwd, note_id });
  expect(index.ok).toBe(true);
  if (!index.ok) throw new Error(index.error.message);

  let answer_input: AnswerAgentInput | undefined;
  const answer = await answer_question_workflow({
    cwd: input.cwd,
    question: input.question,
    answer: async ({ agent_input }) => {
      answer_input = agent_input;
      return build_answer(agent_input);
    },
  });
  expect(answer.ok).toBe(true);
  if (!answer.ok) throw new Error(answer.error.message);
  expect(answer.data.matched_note_ids).toEqual([note_id]);
  expect(answer.data.answer.cited_notes.map((note) => note.note_id)).toEqual([
    note_id,
  ]);

  const source = await get_source(source_id, { cwd: input.cwd });
  const note = await get_note(note_id, { cwd: input.cwd });
  const index_entry = await get_index_entry(note_id, { cwd: input.cwd });
  expect(source.status).toBe('noted');
  expect(note.status).toBe('approved');
  expect(note.source_refs[0].evidence_refs).toEqual([
    'processed/segments.json#seg_0001',
  ]);
  expect(index_entry.status).toBe('approved');

  return { source_id, note_id, answer_input };
}

function build_note_candidate(agent_input: NoteAgentInput): NoteCandidate {
  return {
    title: `${agent_input.source.title} Acceptance Note`,
    conclusions: agent_input.discussion_summary.confirmed_points,
    why_it_matters: [
      'It proves P1 inputs preserve the approved knowledge boundary.',
    ],
    current_understanding:
      'PDF and URL sources can become approved Notes through the same gated workflow.',
    open_questions: [],
    related_note_ids: [],
    source_refs: agent_input.source_refs,
  };
}

function build_answer(agent_input: AnswerAgentInput): GroundedAnswer {
  return {
    conclusion: 'The answer is grounded in approved P1 acceptance notes.',
    cited_notes: agent_input.approved_notes.map((note) => ({
      note_id: note.id,
      title: note.title,
      relevant_points: note.conclusions,
    })),
    unconfirmed_materials: [],
    limitations: [],
  };
}

async function assert_common_artifacts(
  cwd: string,
  source_id: string,
  note_id: string,
): Promise<void> {
  await expect(
    access(source_json_path(source_id, { cwd })),
  ).resolves.toBeUndefined();
  await expect(
    access(`${source_processed_dir(source_id, { cwd })}/clean_text.md`),
  ).resolves.toBeUndefined();
  await expect(
    access(`${source_processed_dir(source_id, { cwd })}/segments.json`),
  ).resolves.toBeUndefined();
  await expect(
    access(`${source_processed_dir(source_id, { cwd })}/metadata.json`),
  ).resolves.toBeUndefined();
  await expect(
    access(note_json_path(note_id, { cwd })),
  ).resolves.toBeUndefined();
  await expect(
    access(note_markdown_path(note_id, { cwd })),
  ).resolves.toBeUndefined();
  await expect(
    access(index_entry_path(note_id, { cwd })),
  ).resolves.toBeUndefined();
}
