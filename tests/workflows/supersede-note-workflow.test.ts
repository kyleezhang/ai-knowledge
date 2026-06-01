import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { NoteCandidate } from '../../src/agents/schemas.js';
import type { NoteAgentInput } from '../../src/agents/note-agent.js';
import { build_index_entry } from '../../src/indexing/build-index-entry.js';
import { render_note_markdown } from '../../src/notes/render-markdown.js';
import { save_index_entry } from '../../src/storage/index-repo.js';
import { create_note, get_note } from '../../src/storage/note-repo.js';
import { get_source } from '../../src/storage/source-repo.js';
import { approve_source_workflow } from '../../src/workflows/approve-source-workflow.js';
import { discuss_source_workflow } from '../../src/workflows/discuss-source-workflow.js';
import { ingest_markdown_workflow } from '../../src/workflows/ingest-markdown-workflow.js';
import { process_source_workflow } from '../../src/workflows/process-source-workflow.js';
import { supersede_note_workflow } from '../../src/workflows/supersede-note-workflow.js';
import { understand_source_workflow } from '../../src/workflows/understand-source-workflow.js';
import { create_test_note } from '../note-test-helpers.js';
import {
  create_temp_dir,
  write_markdown_fixture,
} from '../source-test-helpers.js';

const passed_quality_checks = {
  status: 'passed' as const,
  template_complete: true,
  source_links_present: true,
  empty_sections: [],
  last_checked_at: '2026-05-14T00:00:00.000Z',
};

describe('supersede note workflow', () => {
  it('creates a draft new version, supersedes old Note, updates Source, and removes old index', async () => {
    const cwd = await create_temp_dir();
    const old_note = create_approved_note();
    await create_note(
      { note: old_note, markdown: render_note_markdown(old_note) },
      { cwd },
    );
    await save_index_entry(build_index_entry(old_note), { cwd });
    const source_id = await create_approved_source(
      cwd,
      'New confirmed conclusion',
    );

    const result = await supersede_note_workflow({
      cwd,
      old_note_id: old_note.id,
      source_id,
      now: new Date('2026-05-15T00:00:00.000Z'),
      compose: async ({ agent_input }) => build_note_candidate(agent_input),
    });
    const reloaded_old = await get_note(old_note.id, { cwd });
    const new_note = result.ok
      ? await get_note(result.data.new_note_id, { cwd })
      : null;
    const source = await get_source(source_id, { cwd });

    expect(result.ok).toBe(true);
    if (!result.ok || new_note === null) return;
    expect(new_note.status).toBe('draft');
    expect(new_note.version).toBe(2);
    expect(new_note.root_note_id).toBe(old_note.root_note_id);
    expect(new_note.supersedes_note_id).toBe(old_note.id);
    expect(new_note.superseded_by_note_id).toBeNull();
    expect(reloaded_old.status).toBe('superseded');
    expect(reloaded_old.superseded_by_note_id).toBe(new_note.id);
    expect(source.status).toBe('noted');
    expect(source.note_ids).toContain(new_note.id);
    await expect(
      readdir(path.join(cwd, 'knowledge', 'index', '2026', '05')),
    ).resolves.toEqual([]);
    expect(result.next_actions).toEqual([
      { label: 'Lint note', command: `ai-knowledge note lint ${new_note.id}` },
    ]);
  });

  it('rejects non-approved old Notes and unapproved Sources', async () => {
    const cwd = await create_temp_dir();
    const draft = create_test_note({
      id: 'note_20260514_draft-old',
      root_note_id: 'note_20260514_draft-old',
    });
    const approved = create_approved_note({
      id: 'note_20260514_approved-old',
      root_note_id: 'note_20260514_approved-old',
    });
    await create_note(
      { note: draft, markdown: render_note_markdown(draft) },
      { cwd },
    );
    await create_note(
      { note: approved, markdown: render_note_markdown(approved) },
      { cwd },
    );
    const file_path = await write_markdown_fixture(cwd, 'unapproved.md');
    const ingest = await ingest_markdown_workflow({ file_path, cwd });
    if (!ingest.ok) throw new Error(ingest.error.message);

    const old_not_approved = await supersede_note_workflow({
      cwd,
      old_note_id: draft.id,
      source_id: ingest.data.source_id,
    });
    const source_not_approved = await supersede_note_workflow({
      cwd,
      old_note_id: approved.id,
      source_id: ingest.data.source_id,
    });

    expect(old_not_approved.ok).toBe(false);
    if (!old_not_approved.ok)
      expect(old_not_approved.error.code).toBe('INVALID_STATE');
    expect(source_not_approved.ok).toBe(false);
    if (!source_not_approved.ok)
      expect(source_not_approved.error.code).toBe('INVALID_STATE');
  });

  it('rejects unconfirmed related ids and invented evidence refs', async () => {
    const cwd = await create_temp_dir();
    const old_note = create_approved_note();
    const related = create_approved_note({
      id: 'note_20260514_related',
      root_note_id: 'note_20260514_related',
      title: 'Related',
      slug: 'related',
    });
    await create_note(
      { note: old_note, markdown: render_note_markdown(old_note) },
      { cwd },
    );
    await create_note(
      { note: related, markdown: render_note_markdown(related) },
      { cwd },
    );
    const source_id = await create_approved_source(
      cwd,
      'New confirmed conclusion',
    );

    const unconfirmed_related = await supersede_note_workflow({
      cwd,
      old_note_id: old_note.id,
      source_id,
      compose: async ({ agent_input }) => ({
        ...build_note_candidate(agent_input),
        related_note_ids: [related.id],
      }),
    });
    const invented_evidence = await supersede_note_workflow({
      cwd,
      old_note_id: old_note.id,
      source_id,
      confirmed_related_note_ids: [related.id],
      compose: async ({ agent_input }) => ({
        ...build_note_candidate(agent_input),
        related_note_ids: [related.id],
        source_refs: [
          {
            ...agent_input.source_refs[0],
            evidence_refs: ['processed/segments.json#seg_9999'],
          },
        ],
      }),
    });

    expect(unconfirmed_related.ok).toBe(false);
    if (!unconfirmed_related.ok)
      expect(unconfirmed_related.error.code).toBe('INVALID_INPUT');
    expect(invented_evidence.ok).toBe(false);
    if (!invented_evidence.ok)
      expect(invented_evidence.error.code).toBe('INVALID_INPUT');
  });

  it('returns partial failure when old Note update fails after creating new version', async () => {
    const cwd = await create_temp_dir();
    const old_note = create_approved_note();
    await create_note(
      { note: old_note, markdown: render_note_markdown(old_note) },
      { cwd },
    );
    const source_id = await create_approved_source(
      cwd,
      'New confirmed conclusion',
    );

    const result = await supersede_note_workflow({
      cwd,
      old_note_id: old_note.id,
      source_id,
      compose: async ({ agent_input }) => build_note_candidate(agent_input),
      save_old_note_fn: async () => {
        throw new Error('save old failed');
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PARTIAL_FAILURE');
      expect(result.next_actions?.[0].command).toContain(
        'ai-knowledge note lint',
      );
    }
  });

  it('returns NOT_FOUND for missing old Note or Source', async () => {
    const cwd = await create_temp_dir();
    const old_note = create_approved_note();
    await create_note(
      { note: old_note, markdown: render_note_markdown(old_note) },
      { cwd },
    );
    const source_id = await create_approved_source(
      cwd,
      'New confirmed conclusion',
    );

    const missing_note = await supersede_note_workflow({
      cwd,
      old_note_id: 'note_20260514_missing',
      source_id,
    });
    const missing_source = await supersede_note_workflow({
      cwd,
      old_note_id: old_note.id,
      source_id: 'src_20260514_upload_markdown_missing',
    });

    expect(missing_note.ok).toBe(false);
    if (!missing_note.ok) expect(missing_note.error.code).toBe('NOT_FOUND');
    expect(missing_source.ok).toBe(false);
    if (!missing_source.ok) expect(missing_source.error.code).toBe('NOT_FOUND');
  });
});

function create_approved_note(
  overrides: Partial<ReturnType<typeof create_test_note>> = {},
) {
  return create_test_note({
    status: 'approved',
    approved_at: '2026-05-14T00:00:00.000Z',
    quality_checks: passed_quality_checks,
    ...overrides,
  });
}

function build_note_candidate(agent_input: NoteAgentInput): NoteCandidate {
  return {
    title: `${agent_input.source.title} Version`,
    conclusions: agent_input.discussion_summary.confirmed_points,
    why_it_matters: ['It updates the current understanding.'],
    current_understanding:
      'The new version reflects the latest confirmed conclusion.',
    open_questions: [],
    related_note_ids: [],
    source_refs: agent_input.source_refs,
  };
}

async function create_approved_source(
  cwd: string,
  confirmed_point: string,
): Promise<string> {
  const file_path = await write_markdown_fixture(cwd, 'version-source.md');
  const ingest = await ingest_markdown_workflow({
    file_path,
    cwd,
    now: new Date('2026-05-14T01:00:00.000Z'),
  });
  if (!ingest.ok) throw new Error(ingest.error.message);
  const process = await process_source_workflow({
    cwd,
    source_id: ingest.data.source_id,
    now: new Date('2026-05-14T02:00:00.000Z'),
  });
  if (!process.ok) throw new Error(process.error.message);
  const understand = await understand_source_workflow({
    cwd,
    source_id: ingest.data.source_id,
    now: new Date('2026-05-14T03:00:00.000Z'),
    understand: async () => ({
      summary: 'Draft summary',
      key_points: [confirmed_point],
      uncertainties: [],
      discussion_starters: [],
    }),
  });
  if (!understand.ok) throw new Error(understand.error.message);
  const discuss = await discuss_source_workflow({
    cwd,
    source_id: ingest.data.source_id,
    user_message: 'Confirm updated conclusion.',
    now: new Date('2026-05-14T04:00:00.000Z'),
    discuss: async () => ({
      assistant_message: 'Confirmed.',
      discussion_summary_update: {
        confirmed_points: [confirmed_point],
        open_questions: [],
        unresolved_issues: [],
        next_prompts: [],
        ready_for_approval: true,
      },
    }),
  });
  if (!discuss.ok) throw new Error(discuss.error.message);
  const approve = await approve_source_workflow({
    cwd,
    source_id: ingest.data.source_id,
    now: new Date('2026-05-14T05:00:00.000Z'),
  });
  if (!approve.ok) throw new Error(approve.error.message);
  return ingest.data.source_id;
}
