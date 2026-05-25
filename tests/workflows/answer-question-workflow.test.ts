import { describe, expect, it } from 'vitest';
import { build_index_entry } from '../../src/indexing/build-index-entry.js';
import { render_note_markdown } from '../../src/notes/render-markdown.js';
import { save_index_entry } from '../../src/storage/index-repo.js';
import { create_note } from '../../src/storage/note-repo.js';
import { answer_question_workflow } from '../../src/workflows/answer-question-workflow.js';
import { create_test_note } from '../note-test-helpers.js';
import { create_temp_dir } from '../source-test-helpers.js';

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
