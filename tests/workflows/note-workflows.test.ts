import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { get_note_markdown } from '../../src/storage/note-repo.js';
import { get_source } from '../../src/storage/source-repo.js';
import { approve_source_workflow } from '../../src/workflows/approve-source-workflow.js';
import { compose_note_workflow } from '../../src/workflows/compose-note-workflow.js';
import { discuss_source_workflow } from '../../src/workflows/discuss-source-workflow.js';
import { ingest_markdown_workflow } from '../../src/workflows/ingest-markdown-workflow.js';
import { list_notes_workflow } from '../../src/workflows/list-notes-workflow.js';
import { process_source_workflow } from '../../src/workflows/process-source-workflow.js';
import { render_note_workflow } from '../../src/workflows/render-note-workflow.js';
import { show_note_workflow } from '../../src/workflows/show-note-workflow.js';
import { understand_source_workflow } from '../../src/workflows/understand-source-workflow.js';

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
      compose: async () => ({
        ...note_candidate,
        source_refs: [{ ...note_candidate.source_refs[0], source_id }],
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
      compose: async () => ({
        ...note_candidate,
        conclusions: ['Unsupported conclusion'],
        source_refs: [{ ...note_candidate.source_refs[0], source_id }],
      }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error.message).toBe(
        'Note conclusions must come from confirmed_points.',
      );
  });

  it('returns partial failure when Source update fails after Note creation', async () => {
    const cwd = await create_temp_dir();
    const source_id = await create_approved_source(cwd);

    const result = await compose_note_workflow({
      cwd,
      source_id,
      compose: async () => ({
        ...note_candidate,
        source_refs: [{ ...note_candidate.source_refs[0], source_id }],
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
      compose: async () => ({
        ...note_candidate,
        source_refs: [{ ...note_candidate.source_refs[0], source_id }],
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
  });
});

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
