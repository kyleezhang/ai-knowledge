import { describe, expect, it } from 'vitest';
import { create_test_note } from '../note-test-helpers.js';
import {
  create_temp_dir,
  write_markdown_fixture,
} from '../source-test-helpers.js';
import { render_note_markdown } from '../../src/notes/render-markdown.js';
import { create_note } from '../../src/storage/note-repo.js';
import { get_task } from '../../src/storage/task-repo.js';
import { ingest_markdown_workflow } from '../../src/workflows/ingest-markdown-workflow.js';
import {
  enqueue_task_workflow,
  list_tasks_workflow,
  retry_task_workflow,
  run_task_workflow,
  show_task_workflow,
} from '../../src/workflows/task-workflows.js';

async function ingested_source(cwd: string) {
  const file_path = await write_markdown_fixture(
    cwd,
    'task.md',
    `# Task Source\n\nBody text.\n`,
  );
  const result = await ingest_markdown_workflow({ cwd, file_path });
  if (!result.ok) throw new Error(result.error.message);
  return result.data.source_id;
}

describe('task workflows', () => {
  it('enqueues lists and shows tasks', async () => {
    const cwd = await create_temp_dir();
    const source_id = await ingested_source(cwd);

    const enqueue = await enqueue_task_workflow({
      cwd,
      now: new Date('2026-06-03T00:00:00.000Z'),
      payload: { type: 'source.process', input: { source_id } },
    });
    if (!enqueue.ok) throw new Error(enqueue.error.message);
    const list = await list_tasks_workflow({ cwd });
    const show = await show_task_workflow({
      cwd,
      task_id: enqueue.data.task.task_id,
    });

    expect(enqueue.data.summary.status).toBe('pending');
    expect(list.ok && list.data.tasks).toHaveLength(1);
    expect(show.ok && show.data.task.task_id).toBe(enqueue.data.task.task_id);
  });

  it('runs a source processing task successfully', async () => {
    const cwd = await create_temp_dir();
    const source_id = await ingested_source(cwd);
    const enqueue = await enqueue_task_workflow({
      cwd,
      now: new Date('2026-06-03T00:00:00.000Z'),
      payload: { type: 'source.process', input: { source_id } },
    });
    if (!enqueue.ok) throw new Error(enqueue.error.message);

    const run = await run_task_workflow({
      cwd,
      task_id: enqueue.data.task.task_id,
      now: new Date('2026-06-03T00:01:00.000Z'),
    });

    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(run.data.task.status).toBe('succeeded');
    expect(run.data.task.attempts).toHaveLength(1);
    expect(run.data.task.result_ref).toBe(`source:${source_id}`);
  });

  it('records non-retryable invalid state failures', async () => {
    const cwd = await create_temp_dir();
    const note = create_test_note();
    await create_note({ note, markdown: render_note_markdown(note) }, { cwd });
    const enqueue = await enqueue_task_workflow({
      cwd,
      now: new Date('2026-06-03T00:00:00.000Z'),
      payload: { type: 'note.index', input: { note_id: note.id } },
    });
    if (!enqueue.ok) throw new Error(enqueue.error.message);

    const run = await run_task_workflow({
      cwd,
      task_id: enqueue.data.task.task_id,
    });

    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(run.data.task.status).toBe('failed');
    expect(run.data.task.attempts[0].error).toMatchObject({
      code: 'INVALID_STATE',
      retryable: false,
    });
    await expect(
      retry_task_workflow({ cwd, task_id: run.data.task.task_id }),
    ).resolves.toMatchObject({
      ok: false,
    });
  });

  it('rejects retry for non-retryable task failures without editing history', async () => {
    const cwd = await create_temp_dir();
    const enqueue = await enqueue_task_workflow({
      cwd,
      now: new Date('2026-06-03T00:00:00.000Z'),
      payload: {
        type: 'source.process',
        input: { source_id: 'src_20260514_upload_markdown_missing' },
      },
    });
    if (!enqueue.ok) throw new Error(enqueue.error.message);

    const run = await run_task_workflow({
      cwd,
      task_id: enqueue.data.task.task_id,
    });
    if (!run.ok) throw new Error(run.error.message);
    const retry = await retry_task_workflow({
      cwd,
      task_id: run.data.task.task_id,
    });

    expect(run.data.task.status).toBe('failed');
    expect(retry.ok).toBe(false);
    await expect(
      get_task(run.data.task.task_id, { cwd }),
    ).resolves.toMatchObject({
      attempts: [expect.objectContaining({ attempt_number: 1 })],
    });
  });
});
