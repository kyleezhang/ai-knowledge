import { describe, expect, it } from 'vitest';
import { create_test_note } from '../note-test-helpers.js';
import {
  create_temp_dir,
  write_markdown_fixture,
} from '../source-test-helpers.js';
import {
  classify_task_error,
  fail_task_attempt,
  start_task_attempt,
} from '../../src/domain/local-task.js';
import { render_note_markdown } from '../../src/notes/render-markdown.js';
import { create_note } from '../../src/storage/note-repo.js';
import {
  claim_task,
  get_task,
  save_task,
} from '../../src/storage/task-repo.js';
import { ingest_markdown_workflow } from '../../src/workflows/ingest-markdown-workflow.js';
import {
  enqueue_task_workflow,
  find_active_task_by_payload,
  list_tasks_workflow,
  retry_task_workflow,
  run_task_daemon_workflow,
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

  it('runs scheduler-created note render tasks through existing workflow', async () => {
    const cwd = await create_temp_dir();
    const note = create_test_note();
    await create_note({ note, markdown: 'stale markdown' }, { cwd });
    const enqueue = await enqueue_task_workflow({
      cwd,
      now: new Date('2026-06-03T00:00:00.000Z'),
      payload: { type: 'note.render', input: { note_id: note.id } },
    });
    if (!enqueue.ok) throw new Error(enqueue.error.message);

    const run = await run_task_daemon_workflow({
      cwd,
      owner_id: 'scheduler-daemon',
      now: new Date('2026-06-03T00:01:00.000Z'),
      max_runs: 1,
      idle_exit_after: 1,
      poll_interval_ms: 0,
      wait: async () => {},
    });

    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(run.data.summary.runs).toEqual([
      expect.objectContaining({ type: 'note.render', status: 'succeeded' }),
    ]);
  });

  it('finds active tasks with equivalent payloads for scheduler dedupe', async () => {
    const cwd = await create_temp_dir();
    const source_id = await ingested_source(cwd);
    const payload = { type: 'source.process' as const, input: { source_id } };
    const enqueue = await enqueue_task_workflow({
      cwd,
      now: new Date('2026-06-03T00:00:00.000Z'),
      payload,
    });
    if (!enqueue.ok) throw new Error(enqueue.error.message);

    await expect(
      find_active_task_by_payload({ cwd, payload }),
    ).resolves.toEqual(enqueue.data.task);
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

  it('daemon runs pending tasks up to max runs', async () => {
    const cwd = await create_temp_dir();
    const first_source_id = await ingested_source(cwd);
    const second_source_id = await ingested_source(cwd);
    const first = await enqueue_task_workflow({
      cwd,
      now: new Date('2026-06-03T00:00:00.000Z'),
      payload: {
        type: 'source.process',
        input: { source_id: first_source_id },
      },
    });
    const second = await enqueue_task_workflow({
      cwd,
      now: new Date('2026-06-03T00:01:00.000Z'),
      payload: {
        type: 'source.process',
        input: { source_id: second_source_id },
      },
    });
    if (!first.ok || !second.ok) throw new Error('enqueue failed');

    const daemon = await run_task_daemon_workflow({
      cwd,
      owner_id: 'daemon-a',
      now: new Date('2026-06-03T00:02:00.000Z'),
      max_runs: 2,
      idle_exit_after: 1,
      poll_interval_ms: 0,
      wait: async () => {},
    });

    expect(daemon.ok).toBe(true);
    if (!daemon.ok) throw new Error(daemon.error.message);
    expect(daemon.data.summary.exit_reason).toBe('max_runs_reached');
    expect(daemon.data.summary.runs).toHaveLength(2);
    await expect(
      get_task(first.data.task.task_id, { cwd }),
    ).resolves.toMatchObject({
      status: 'succeeded',
      attempts: [expect.objectContaining({ attempt_number: 1 })],
      lease: null,
    });
    await expect(
      get_task(second.data.task.task_id, { cwd }),
    ).resolves.toMatchObject({
      status: 'succeeded',
      attempts: [expect.objectContaining({ attempt_number: 1 })],
      lease: null,
    });
  });

  it('daemon exits after idle cycles when no eligible tasks exist', async () => {
    const cwd = await create_temp_dir();
    const daemon = await run_task_daemon_workflow({
      cwd,
      owner_id: 'daemon-a',
      now: new Date('2026-06-03T00:00:00.000Z'),
      max_runs: 10,
      idle_exit_after: 2,
      poll_interval_ms: 0,
      wait: async () => {},
    });

    expect(daemon.ok).toBe(true);
    if (!daemon.ok) throw new Error(daemon.error.message);
    expect(daemon.data.summary.exit_reason).toBe('idle_exit');
    expect(daemon.data.summary.idle_cycles).toBe(2);
    expect(daemon.data.summary.runs).toEqual([]);
  });

  it('daemon respects graceful stop before claiming another task', async () => {
    const cwd = await create_temp_dir();
    const source_id = await ingested_source(cwd);
    const enqueue = await enqueue_task_workflow({
      cwd,
      now: new Date('2026-06-03T00:00:00.000Z'),
      payload: { type: 'source.process', input: { source_id } },
    });
    if (!enqueue.ok) throw new Error(enqueue.error.message);
    let checks = 0;

    const daemon = await run_task_daemon_workflow({
      cwd,
      owner_id: 'daemon-a',
      now: new Date('2026-06-03T00:01:00.000Z'),
      max_runs: 10,
      idle_exit_after: 1,
      poll_interval_ms: 0,
      wait: async () => {},
      should_stop: () => {
        checks += 1;
        return checks > 1;
      },
    });

    expect(daemon.ok).toBe(true);
    if (!daemon.ok) throw new Error(daemon.error.message);
    expect(daemon.data.summary.exit_reason).toBe('stopped');
    expect(daemon.data.summary.runs).toHaveLength(1);
    await expect(
      get_task(enqueue.data.task.task_id, { cwd }),
    ).resolves.toMatchObject({
      status: 'succeeded',
      lease: null,
    });
  });

  it('daemon skips not-yet-due retryable failures and runs them when due', async () => {
    const cwd = await create_temp_dir();
    const source_id = await ingested_source(cwd);
    const enqueue = await enqueue_task_workflow({
      cwd,
      now: new Date('2026-06-03T00:00:00.000Z'),
      payload: { type: 'source.process', input: { source_id } },
      retry_policy: { max_attempts: 3, retry_delay_ms: 60_000 },
    });
    if (!enqueue.ok) throw new Error(enqueue.error.message);
    const retryable = fail_task_attempt({
      task: start_task_attempt(enqueue.data.task, '2026-06-03T00:01:00.000Z'),
      now: '2026-06-03T00:02:00.000Z',
      error: classify_task_error({
        code: 'STORAGE_FAILED',
        message: 'temporary storage error',
        stage: 'storage',
      }),
    });
    await save_task(retryable, { cwd });

    const not_due = await run_task_daemon_workflow({
      cwd,
      owner_id: 'daemon-a',
      now: new Date('2026-06-03T00:02:30.000Z'),
      max_runs: 1,
      idle_exit_after: 1,
      poll_interval_ms: 0,
      wait: async () => {},
    });
    if (!not_due.ok) throw new Error(not_due.error.message);
    expect(not_due.data.summary.runs).toEqual([]);

    const due = await run_task_daemon_workflow({
      cwd,
      owner_id: 'daemon-a',
      now: new Date('2026-06-03T00:03:00.000Z'),
      max_runs: 1,
      idle_exit_after: 1,
      poll_interval_ms: 0,
      wait: async () => {},
    });
    if (!due.ok) throw new Error(due.error.message);
    expect(due.data.summary.runs).toHaveLength(1);
    await expect(
      get_task(enqueue.data.task.task_id, { cwd }),
    ).resolves.toMatchObject({
      status: 'succeeded',
      attempts: [
        expect.objectContaining({ attempt_number: 1 }),
        expect.objectContaining({ attempt_number: 2 }),
      ],
    });
  });

  it('daemon records workflow gate failures without bypassing rules', async () => {
    const cwd = await create_temp_dir();
    const note = create_test_note();
    await create_note({ note, markdown: render_note_markdown(note) }, { cwd });
    const enqueue = await enqueue_task_workflow({
      cwd,
      now: new Date('2026-06-03T00:00:00.000Z'),
      payload: { type: 'note.index', input: { note_id: note.id } },
    });
    if (!enqueue.ok) throw new Error(enqueue.error.message);

    const daemon = await run_task_daemon_workflow({
      cwd,
      owner_id: 'daemon-a',
      now: new Date('2026-06-03T00:01:00.000Z'),
      max_runs: 1,
      idle_exit_after: 1,
      poll_interval_ms: 0,
      wait: async () => {},
    });

    expect(daemon.ok).toBe(true);
    if (!daemon.ok) throw new Error(daemon.error.message);
    expect(daemon.data.summary.runs).toEqual([
      expect.objectContaining({ status: 'failed' }),
    ]);
    await expect(
      get_task(enqueue.data.task.task_id, { cwd }),
    ).resolves.toMatchObject({
      status: 'failed',
      attempts: [
        expect.objectContaining({
          error: expect.objectContaining({ code: 'INVALID_STATE' }),
        }),
      ],
      lease: null,
    });
  });

  it('daemon advances multiple queued tasks end to end', async () => {
    const cwd = await create_temp_dir();
    const first_source_id = await ingested_source(cwd);
    const second_source_id = await ingested_source(cwd);
    const first = await enqueue_task_workflow({
      cwd,
      now: new Date('2026-06-03T00:00:00.000Z'),
      payload: {
        type: 'source.process',
        input: { source_id: first_source_id },
      },
    });
    const second = await enqueue_task_workflow({
      cwd,
      now: new Date('2026-06-03T00:01:00.000Z'),
      payload: {
        type: 'source.process',
        input: { source_id: second_source_id },
      },
    });
    if (!first.ok || !second.ok) throw new Error('enqueue failed');

    const daemon = await run_task_daemon_workflow({
      cwd,
      owner_id: 'daemon-e2e',
      now: new Date('2026-06-03T00:02:00.000Z'),
      max_runs: 10,
      idle_exit_after: 1,
      poll_interval_ms: 0,
      wait: async () => {},
    });

    expect(daemon.ok).toBe(true);
    if (!daemon.ok) throw new Error(daemon.error.message);
    expect(daemon.data.summary.exit_reason).toBe('idle_exit');
    expect(daemon.data.summary.runs.map((run) => run.task_id)).toEqual([
      first.data.task.task_id,
      second.data.task.task_id,
    ]);
    await expect(
      get_task(first.data.task.task_id, { cwd }),
    ).resolves.toMatchObject({
      status: 'succeeded',
      attempts: [expect.objectContaining({ status: 'succeeded' })],
      result_ref: `source:${first_source_id}`,
    });
    await expect(
      get_task(second.data.task.task_id, { cwd }),
    ).resolves.toMatchObject({
      status: 'succeeded',
      attempts: [expect.objectContaining({ status: 'succeeded' })],
      result_ref: `source:${second_source_id}`,
    });
  });

  it('daemon and manual runner do not duplicate a leased task', async () => {
    const cwd = await create_temp_dir();
    const source_id = await ingested_source(cwd);
    const enqueue = await enqueue_task_workflow({
      cwd,
      now: new Date('2026-06-03T00:00:00.000Z'),
      payload: { type: 'source.process', input: { source_id } },
    });
    if (!enqueue.ok) throw new Error(enqueue.error.message);
    const claimed = await claim_task(
      {
        task_id: enqueue.data.task.task_id,
        owner_id: 'daemon-a',
        now: '2026-06-03T00:01:00.000Z',
        lease_timeout_ms: 30_000,
      },
      { cwd },
    );
    expect(claimed).not.toBeNull();

    const manual = await run_task_workflow({
      cwd,
      task_id: enqueue.data.task.task_id,
      now: new Date('2026-06-03T00:01:10.000Z'),
    });

    expect(manual.ok).toBe(false);
    if (manual.ok) throw new Error('manual runner should be blocked');
    expect(manual.error.code).toBe('INVALID_STATE');
    await expect(
      get_task(enqueue.data.task.task_id, { cwd }),
    ).resolves.toMatchObject({
      attempts: [],
      lease: expect.objectContaining({ owner_id: 'daemon-a' }),
    });
  });
});
