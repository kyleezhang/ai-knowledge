import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  create_note,
  get_note,
  get_note_markdown,
} from '../../src/storage/note-repo.js';
import { get_source } from '../../src/storage/source-repo.js';
import { approve_source_workflow } from '../../src/workflows/approve-source-workflow.js';
import { default_quality_checks } from '../../src/domain/note.js';
import { compose_note_workflow } from '../../src/workflows/compose-note-workflow.js';
import { discuss_source_workflow } from '../../src/workflows/discuss-source-workflow.js';
import { ingest_markdown_workflow } from '../../src/workflows/ingest-markdown-workflow.js';
import { list_notes_workflow } from '../../src/workflows/list-notes-workflow.js';
import { process_source_workflow } from '../../src/workflows/process-source-workflow.js';
import { render_note_workflow } from '../../src/workflows/render-note-workflow.js';
import { show_note_workflow } from '../../src/workflows/show-note-workflow.js';
import { understand_source_workflow } from '../../src/workflows/understand-source-workflow.js';
import { create_test_note } from '../note-test-helpers.js';

const note_candidate = {
  title: 'Composed Note',
  conclusions: ['Confirmed conclusion'],
  why_it_matters: ['It matters.'],
  current_understanding: 'Current understanding.',
  open_questions: [],
  related_note_ids: [],
  source_refs: [
    {
      source_id: 'src_20260514_upload_markdown_note-source',
      source_title: 'Note Source',
      source_url: null,
      evidence_refs: ['processed/segments.json#seg_0001'],
    },
  ],
};

describe('note workflows', () => {
  it('composes a draft note and advances Source to noted', async () => {
    const cwd = await create_temp_dir();
    const source_id = await create_approved_source(cwd);

    const result = await compose_note_workflow({
      cwd,
      source_id,
      now: new Date('2026-05-14T04:00:00.000Z'),
      compose: async ({ agent_input }) => ({
        ...note_candidate,
        source_refs: agent_input.source_refs,
      }),
    });
    const source = await get_source(source_id, { cwd });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.note.status).toBe('draft');
    expect(source.status).toBe('noted');
    expect(source.note_ids).toEqual([result.data.note_id]);
    expect(await get_note_markdown(result.data.note_id, { cwd })).toContain(
      '## 讨论后的结论',
    );
    expect(result.next_actions).toEqual([
      {
        label: 'Lint note',
        command: `ai-knowledge note lint ${result.data.note_id}`,
      },
    ]);
  });

  it('composes with confirmed related notes only', async () => {
    const cwd = await create_temp_dir();
    const related_note = create_approved_test_note({
      id: 'note_20260514_related-memory',
      title: 'Related Memory',
      slug: 'related-memory',
      root_note_id: 'note_20260514_related-memory',
      conclusions: ['Related conclusion'],
    });
    await create_note(
      { note: related_note, markdown: '# Related Memory\n' },
      { cwd },
    );
    const source_id = await create_approved_source(cwd);

    const result = await compose_note_workflow({
      cwd,
      source_id,
      confirmed_related_note_ids: [related_note.id],
      compose: async ({ agent_input }) => ({
        ...note_candidate,
        source_refs: agent_input.source_refs,
        related_note_ids: [related_note.id],
      }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    await expect(get_note(result.data.note_id, { cwd })).resolves.toMatchObject(
      {
        related_note_ids: [related_note.id],
      },
    );
  });

  it('rejects unconfirmed related note ids from the Note Agent', async () => {
    const cwd = await create_temp_dir();
    const related_note = create_approved_test_note({
      id: 'note_20260514_unconfirmed',
      title: 'Unconfirmed',
      slug: 'unconfirmed',
      root_note_id: 'note_20260514_unconfirmed',
    });
    await create_note(
      { note: related_note, markdown: '# Unconfirmed\n' },
      { cwd },
    );
    const source_id = await create_approved_source(cwd);

    const result = await compose_note_workflow({
      cwd,
      source_id,
      compose: async ({ agent_input }) => ({
        ...note_candidate,
        source_refs: agent_input.source_refs,
        related_note_ids: [related_note.id],
      }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain(
        'Note related_note_ids must be confirmed before composition',
      );
    }
  });

  it('rejects confirmed related note ids that are not approved', async () => {
    const cwd = await create_temp_dir();
    const draft_note = create_test_note({
      id: 'note_20260514_draft-related',
      title: 'Draft Related',
      slug: 'draft-related',
      root_note_id: 'note_20260514_draft-related',
    });
    await create_note(
      { note: draft_note, markdown: '# Draft Related\n' },
      { cwd },
    );
    const source_id = await create_approved_source(cwd);

    const result = await compose_note_workflow({
      cwd,
      source_id,
      confirmed_related_note_ids: [draft_note.id],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain(
        'Confirmed related notes must be approved',
      );
    }
  });

  it('rejects compose when Source is not approved_for_note', async () => {
    const cwd = await create_temp_dir();
    const file_path = await write_fixture(cwd);
    const ingest = await ingest_markdown_workflow({ file_path, cwd });
    if (!ingest.ok) throw new Error(ingest.error.message);

    const result = await compose_note_workflow({
      cwd,
      source_id: ingest.data.source_id,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_INPUT');
  });

  it('rejects note candidate conclusions outside confirmed points', async () => {
    const cwd = await create_temp_dir();
    const source_id = await create_approved_source(cwd);

    const result = await compose_note_workflow({
      cwd,
      source_id,
      compose: async ({ agent_input }) => ({
        ...note_candidate,
        conclusions: ['Unsupported conclusion'],
        source_refs: agent_input.source_refs,
      }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error.message).toBe(
        'Note conclusions must come from confirmed_points.',
      );
  });

  it('rejects note candidate evidence refs outside processed segment locators', async () => {
    const cwd = await create_temp_dir();
    const source_id = await create_approved_source(cwd);

    const result = await compose_note_workflow({
      cwd,
      source_id,
      compose: async ({ agent_input }) => ({
        ...note_candidate,
        source_refs: [
          {
            ...agent_input.source_refs[0],
            evidence_refs: ['processed/segments.json#seg_9999'],
          },
        ],
      }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain(
        'Note evidence_refs must come from processed segment locators',
      );
    }
  });

  it('returns partial failure when Source update fails after Note creation', async () => {
    const cwd = await create_temp_dir();
    const source_id = await create_approved_source(cwd);

    const result = await compose_note_workflow({
      cwd,
      source_id,
      compose: async ({ agent_input }) => ({
        ...note_candidate,
        source_refs: agent_input.source_refs,
      }),
      save_source_fn: async () => {
        throw new Error('save source failed');
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('PARTIAL_FAILURE');
  });

  it('renders, lists, and shows notes', async () => {
    const cwd = await create_temp_dir();
    const source_id = await create_approved_source(cwd);
    const compose = await compose_note_workflow({
      cwd,
      source_id,
      compose: async ({ agent_input }) => ({
        ...note_candidate,
        source_refs: agent_input.source_refs,
      }),
    });
    if (!compose.ok) throw new Error(compose.error.message);

    const render = await render_note_workflow({
      cwd,
      note_id: compose.data.note_id,
    });
    const list = await list_notes_workflow({ cwd, status: 'draft' });
    const show = await show_note_workflow({
      cwd,
      note_id: compose.data.note_id,
    });

    expect(render.ok).toBe(true);
    expect(list.ok).toBe(true);
    expect(show.ok).toBe(true);
    if (!list.ok || !show.ok) return;
    expect(list.data.notes.map((note) => note.id)).toEqual([
      compose.data.note_id,
    ]);
    expect(show.data.note.conclusions).toEqual(['Confirmed conclusion']);
    expect(show.data.note).toMatchObject({
      version: 1,
      root_note_id: compose.data.note_id,
      supersedes_note_id: null,
      superseded_by_note_id: null,
    });
  });
});

function create_approved_test_note(
  overrides: Partial<ReturnType<typeof create_test_note>> = {},
) {
  return create_test_note({
    status: 'approved',
    approved_at: '2026-05-14T00:00:00.000Z',
    quality_checks: {
      ...default_quality_checks,
      status: 'passed',
      template_complete: true,
      source_links_present: true,
    },
    ...overrides,
  });
}

async function create_temp_dir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'ai-knowledge-note-'));
}

async function write_fixture(cwd: string): Promise<string> {
  const file_path = path.join(cwd, 'source.md');
  await writeFile(file_path, '# Note Source\n\nBody.\n', 'utf8');
  return file_path;
}

async function create_approved_source(cwd: string): Promise<string> {
  const file_path = await write_fixture(cwd);
  const ingest = await ingest_markdown_workflow({
    file_path,
    cwd,
    now: new Date('2026-05-14T00:00:00.000Z'),
  });
  if (!ingest.ok) throw new Error(ingest.error.message);
  const process = await process_source_workflow({
    cwd,
    source_id: ingest.data.source_id,
    now: new Date('2026-05-14T01:00:00.000Z'),
  });
  if (!process.ok) throw new Error(process.error.message);
  const understand = await understand_source_workflow({
    cwd,
    source_id: ingest.data.source_id,
    now: new Date('2026-05-14T02:00:00.000Z'),
    understand: async () => ({
      summary: 'Summary',
      key_points: ['Point'],
      uncertainties: [],
      discussion_starters: [],
    }),
  });
  if (!understand.ok) throw new Error(understand.error.message);
  const discuss = await discuss_source_workflow({
    cwd,
    source_id: ingest.data.source_id,
    user_message: 'Ready',
    now: new Date('2026-05-14T03:00:00.000Z'),
    discuss: async () => ({
      assistant_message: 'Ready.',
      discussion_summary_update: {
        confirmed_points: ['Confirmed conclusion'],
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
  });
  if (!approve.ok) throw new Error(approve.error.message);
  return ingest.data.source_id;
}
