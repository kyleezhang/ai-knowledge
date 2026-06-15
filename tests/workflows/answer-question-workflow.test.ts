import { describe, expect, it } from 'vitest';
import { build_index_entry } from '../../src/indexing/build-index-entry.js';
import { render_note_markdown } from '../../src/notes/render-markdown.js';
import { create_candidate } from '../../src/storage/candidate-repo.js';
import {
  save_index_entry,
  list_index_entries,
} from '../../src/storage/index-repo.js';
import { archive_note_workflow } from '../../src/workflows/archive-note-workflow.js';
import { create_note, list_notes } from '../../src/storage/note-repo.js';
import { get_source } from '../../src/storage/source-repo.js';
import { answer_question_workflow } from '../../src/workflows/answer-question-workflow.js';
import { create_test_candidate } from '../candidate-test-helpers.js';
import { create_test_note } from '../note-test-helpers.js';
import {
  create_temp_dir,
  write_markdown_fixture,
} from '../source-test-helpers.js';
import { ingest_markdown_workflow } from '../../src/workflows/ingest-markdown-workflow.js';
import { process_source_workflow } from '../../src/workflows/process-source-workflow.js';

const passed_quality_checks = {
  status: 'passed',
  template_complete: true,
  source_links_present: true,
  empty_sections: [],
  last_checked_at: '2026-05-14T00:00:00.000Z',
} as const;

function approved_note(id: string, title: string) {
  return create_test_note({
    id,
    root_note_id: id,
    title,
    slug: title.toLowerCase().replace(/\s+/gu, '-'),
    status: 'approved',
    approved_at: '2026-05-14T00:00:00.000Z',
    conclusions: [`${title} conclusion`],
    quality_checks: { ...passed_quality_checks, empty_sections: [] },
  });
}

describe('answer question workflow', () => {
  it('returns no confirmed knowledge without matches and does not call agent', async () => {
    const cwd = await create_temp_dir();
    let called = false;

    const result = await answer_question_workflow({
      cwd,
      question: 'unknown',
      answer: async () => {
        called = true;
        throw new Error('should not call');
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(called).toBe(false);
    expect(result.data.answer.conclusion).toBe('没有相关已确认知识。');
    expect(result.data.retrieval_results).toEqual([]);
    expect(result.data.unconfirmed_materials).toEqual([]);
  });

  it('answers from matching approved notes', async () => {
    const cwd = await create_temp_dir();
    const note = approved_note('note_20260514_agent-memory', 'Agent Memory');
    await create_note({ note, markdown: render_note_markdown(note) }, { cwd });
    await save_index_entry(build_index_entry(note), { cwd });

    const result = await answer_question_workflow({
      cwd,
      question: 'agent memory',
      answer: async ({ agent_input }) => {
        expect(
          agent_input.approved_notes[0].source_refs[0].evidence_refs,
        ).toEqual(['processed/segments.json#seg_0001']);
        return {
          conclusion: 'Agent memory helps.',
          cited_notes: agent_input.approved_notes.map((item) => ({
            note_id: item.id,
            title: item.title,
            relevant_points: item.conclusions,
          })),
          unconfirmed_materials: [],
          limitations: [],
        };
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.matched_note_ids).toEqual([note.id]);
    expect(result.data.answer.cited_notes[0].note_id).toBe(note.id);
  });

  it('uses explicit fallback only when enabled and keeps state unchanged', async () => {
    const cwd = await create_temp_dir();
    const fixture = await write_markdown_fixture(
      cwd,
      'fallback-answer.md',
      `# Fallback Source\n\nFallback workflow evidence appears in processed material.\n`,
    );
    const ingest = await ingest_markdown_workflow({ cwd, file_path: fixture });
    if (!ingest.ok) throw new Error(ingest.error.message);
    const process = await process_source_workflow({
      cwd,
      source_id: ingest.data.source_id,
    });
    if (!process.ok) throw new Error(process.error.message);
    const before_source = await get_source(ingest.data.source_id, { cwd });
    const before_notes = await list_notes({}, { cwd });
    const before_index = await list_index_entries({ cwd });
    let received_unconfirmed = false;

    const result = await answer_question_workflow({
      cwd,
      question: 'fallback workflow evidence',
      fallback_to_unconfirmed: true,
      answer: async ({ agent_input }) => {
        received_unconfirmed =
          agent_input.approved_notes.length === 0 &&
          (agent_input.unconfirmed_materials?.length ?? 0) > 0;
        return {
          conclusion: 'Unconfirmed fallback suggests relevant material exists.',
          cited_notes: [],
          unconfirmed_materials: agent_input.unconfirmed_materials ?? [],
          limitations: ['Uses unconfirmed material.'],
        };
      },
    });
    const after_source = await get_source(ingest.data.source_id, { cwd });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(received_unconfirmed).toBe(true);
    expect(result.data.matched_note_ids).toEqual([]);
    expect(result.data.unconfirmed_materials[0]).toMatchObject({
      confirmation_status: 'unconfirmed',
      source_id: ingest.data.source_id,
      material_type: 'processed_segment',
    });
    expect(after_source).toEqual(before_source);
    await expect(list_notes({}, { cwd })).resolves.toEqual(before_notes);
    await expect(list_index_entries({ cwd })).resolves.toEqual(before_index);
  });

  it('does not fallback when no eligible structured material exists', async () => {
    const cwd = await create_temp_dir();
    const fixture = await write_markdown_fixture(
      cwd,
      'raw-fallback-answer.md',
      `# Raw Fallback\n\nrawfallbackanswer only exists in raw material.\n`,
    );
    const ingest = await ingest_markdown_workflow({ cwd, file_path: fixture });
    if (!ingest.ok) throw new Error(ingest.error.message);
    let called = false;

    const result = await answer_question_workflow({
      cwd,
      question: 'rawfallbackanswer',
      fallback_to_unconfirmed: true,
      answer: async () => {
        called = true;
        throw new Error('should not call');
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(called).toBe(false);
    expect(result.data.unconfirmed_materials).toEqual([]);
    expect(result.data.answer.conclusion).toBe('没有相关已确认知识。');
  });

  it('does not answer directly from matching Candidates', async () => {
    const cwd = await create_temp_dir();
    await create_candidate(
      create_test_candidate({
        title: 'Agent Candidate',
        summary: 'agent candidate memory should not be answer evidence',
      }),
      { cwd },
    );
    let called = false;

    const result = await answer_question_workflow({
      cwd,
      question: 'agent candidate memory',
      answer: async () => {
        called = true;
        throw new Error('should not call');
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(called).toBe(false);
    expect(result.data.matched_note_ids).toEqual([]);
    expect(result.data.answer.conclusion).toBe('没有相关已确认知识。');
  });

  it('does not answer from archived or superseded Notes or fallback to raw Sources', async () => {
    const cwd = await create_temp_dir();
    const archived = approved_note(
      'note_20260514_archive-answer',
      'Archive Answer',
    );
    const superseded = approved_note(
      'note_20260514_superseded-answer',
      'Superseded Answer',
    );
    await create_note(
      { note: archived, markdown: render_note_markdown(archived) },
      { cwd },
    );
    await create_note(
      {
        note: {
          ...superseded,
          status: 'superseded',
          superseded_by_note_id: 'note_20260514_new-answer',
        },
        markdown: render_note_markdown({
          ...superseded,
          status: 'superseded',
          superseded_by_note_id: 'note_20260514_new-answer',
        }),
      },
      { cwd },
    );
    await save_index_entry(build_index_entry(archived), { cwd });
    await save_index_entry(build_index_entry(superseded), { cwd });
    const archive = await archive_note_workflow({ cwd, note_id: archived.id });
    if (!archive.ok) throw new Error(archive.error.message);
    let called = false;

    const archived_result = await answer_question_workflow({
      cwd,
      question: 'archive answer',
      answer: async () => {
        called = true;
        throw new Error('should not call');
      },
    });
    const superseded_result = await answer_question_workflow({
      cwd,
      question: 'superseded answer',
      answer: async () => {
        called = true;
        throw new Error('should not call');
      },
    });

    expect(archived_result.ok).toBe(true);
    expect(superseded_result.ok).toBe(true);
    if (!archived_result.ok || !superseded_result.ok) return;
    expect(called).toBe(false);
    expect(archived_result.data.matched_note_ids).toEqual([]);
    expect(superseded_result.data.matched_note_ids).toEqual([]);
    expect(archived_result.data.answer.conclusion).toBe('没有相关已确认知识。');
    expect(superseded_result.data.answer.conclusion).toBe(
      '没有相关已确认知识。',
    );
    expect(archived_result.data.answer.unconfirmed_materials).toEqual([]);
    expect(superseded_result.data.answer.unconfirmed_materials).toEqual([]);
  });

  it('respects top_k', async () => {
    const cwd = await create_temp_dir();
    const first = approved_note('note_20260514_agent-memory', 'Agent Memory');
    const second = approved_note('note_20260514_agent-tools', 'Agent Tools');
    await create_note(
      { note: first, markdown: render_note_markdown(first) },
      { cwd },
    );
    await create_note(
      { note: second, markdown: render_note_markdown(second) },
      { cwd },
    );
    await save_index_entry(build_index_entry(first), { cwd });
    await save_index_entry(build_index_entry(second), { cwd });

    const result = await answer_question_workflow({
      cwd,
      question: 'agent',
      top_k: 1,
      answer: async ({ agent_input }) => ({
        conclusion: 'One note.',
        cited_notes: agent_input.approved_notes.map((item) => ({
          note_id: item.id,
          title: item.title,
          relevant_points: item.conclusions,
        })),
        unconfirmed_materials: [],
        limitations: [],
      }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.matched_note_ids).toHaveLength(1);
  });

  it('answers in hybrid mode while passing only approved notes to the agent', async () => {
    const cwd = await create_temp_dir();
    const note = approved_note('note_20260514_hybrid-answer', 'Hybrid Answer');
    await create_note({ note, markdown: render_note_markdown(note) }, { cwd });
    await save_index_entry(
      { ...build_index_entry(note), keywords: ['hybrid'], tags: ['answer'] },
      { cwd },
    );
    let agent_received_chunk_text = false;
    const previous = process.env.VOYAGE_API_KEY;
    delete process.env.VOYAGE_API_KEY;

    try {
      const result = await answer_question_workflow({
        cwd,
        question: 'hybrid answer',
        retrieval_mode: 'hybrid',
        include_retrieval_debug: true,
        metadata_filter: { boost_tags: ['answer'] },
        answer: async ({ agent_input }) => {
          agent_received_chunk_text = agent_input.approved_notes.some((item) =>
            JSON.stringify(item).includes('best chunk'),
          );
          return {
            conclusion: 'Hybrid answer grounded in Note JSON.',
            cited_notes: agent_input.approved_notes.map((item) => ({
              note_id: item.id,
              title: item.title,
              relevant_points: item.conclusions,
            })),
            unconfirmed_materials: [],
            limitations: [],
          };
        },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(agent_received_chunk_text).toBe(false);
      expect(result.data.matched_note_ids).toEqual([note.id]);
      expect(result.data.retrieval_results).toHaveLength(1);
      expect(
        result.data.retrieval_results[0].signals.map((signal) => signal.type),
      ).toEqual(['keyword', 'metadata']);
    } finally {
      if (previous === undefined) {
        delete process.env.VOYAGE_API_KEY;
      } else {
        process.env.VOYAGE_API_KEY = previous;
      }
    }
  });

  it('hybrid mode falls back to keyword matches when vector is unavailable', async () => {
    const cwd = await create_temp_dir();
    const note = approved_note(
      'note_20260514_hybrid-fallback',
      'Hybrid Fallback',
    );
    await create_note({ note, markdown: render_note_markdown(note) }, { cwd });
    await save_index_entry(build_index_entry(note), { cwd });
    const previous = process.env.VOYAGE_API_KEY;
    delete process.env.VOYAGE_API_KEY;

    try {
      const result = await answer_question_workflow({
        cwd,
        question: 'hybrid fallback',
        retrieval_mode: 'hybrid',
        include_retrieval_debug: true,
        answer: async ({ agent_input }) => ({
          conclusion: 'Fallback answer.',
          cited_notes: agent_input.approved_notes.map((item) => ({
            note_id: item.id,
            title: item.title,
            relevant_points: item.conclusions,
          })),
          unconfirmed_materials: [],
          limitations: [],
        }),
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.matched_note_ids).toEqual([note.id]);
      expect(result.data.retrieval_results[0].debug.join('\n')).toContain(
        'no vector_ref',
      );
    } finally {
      if (previous === undefined) {
        delete process.env.VOYAGE_API_KEY;
      } else {
        process.env.VOYAGE_API_KEY = previous;
      }
    }
  });

  it('surfaces answer agent failure', async () => {
    const cwd = await create_temp_dir();
    const note = approved_note('note_20260514_agent-memory', 'Agent Memory');
    await create_note({ note, markdown: render_note_markdown(note) }, { cwd });
    await save_index_entry(build_index_entry(note), { cwd });

    const result = await answer_question_workflow({
      cwd,
      question: 'agent memory',
      answer: async () => {
        throw new Error('agent failed');
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe('agent failed');
  });
});
