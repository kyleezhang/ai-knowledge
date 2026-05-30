import { describe, expect, it } from 'vitest';
import { default_quality_checks } from '../../src/domain/note.js';
import { create_note } from '../../src/storage/note-repo.js';
import { discover_related_notes_workflow } from '../../src/workflows/discover-related-notes-workflow.js';
import { create_test_note } from '../note-test-helpers.js';
import { create_temp_dir } from '../source-test-helpers.js';

const passed_quality_checks = {
  ...default_quality_checks,
  status: 'passed' as const,
  template_complete: true,
  source_links_present: true,
};

describe('discover related notes workflow', () => {
  it('generates explainable candidates from approved Notes only', async () => {
    const cwd = await create_temp_dir();
    const approved = create_test_note({
      id: 'note_20260514_agent-memory',
      title: 'Agent Memory',
      slug: 'agent-memory',
      root_note_id: 'note_20260514_agent-memory',
      status: 'approved',
      approved_at: '2026-05-14T00:00:00.000Z',
      conclusions: ['Agent memory improves long term learning.'],
      current_understanding: 'Memory and retrieval help agent learning.',
      quality_checks: passed_quality_checks,
    });
    const draft = create_test_note({
      id: 'note_20260514_agent-draft',
      title: 'Agent Draft',
      slug: 'agent-draft',
      root_note_id: 'note_20260514_agent-draft',
      conclusions: ['Agent memory draft.'],
    });
    await create_note(
      { note: approved, markdown: '# Agent Memory\n' },
      { cwd },
    );
    await create_note({ note: draft, markdown: '# Agent Draft\n' }, { cwd });

    const result = await discover_related_notes_workflow({
      cwd,
      source_text: 'This source discusses agent memory and retrieval learning.',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.candidates).toEqual([
      {
        note_id: approved.id,
        title: approved.title,
        reason:
          'Shares approved note keywords: agent, memory, learning, and, retrieval',
        status: 'pending',
      },
    ]);
  });

  it('excludes the target note and returns an empty result without overlap', async () => {
    const cwd = await create_temp_dir();
    const note = create_test_note({
      id: 'note_20260514_target',
      title: 'Target Note',
      slug: 'target',
      root_note_id: 'note_20260514_target',
      status: 'approved',
      approved_at: '2026-05-14T00:00:00.000Z',
      quality_checks: passed_quality_checks,
    });
    await create_note({ note, markdown: '# Target\n' }, { cwd });

    const own_note = await discover_related_notes_workflow({
      cwd,
      note_id: note.id,
    });
    const no_overlap = await discover_related_notes_workflow({
      cwd,
      source_text: 'completely different vocabulary',
    });

    expect(own_note.ok).toBe(true);
    expect(no_overlap.ok).toBe(true);
    if (!own_note.ok || !no_overlap.ok) {
      return;
    }
    expect(own_note.data.candidates).toEqual([]);
    expect(no_overlap.data.candidates).toEqual([]);
  });
});
