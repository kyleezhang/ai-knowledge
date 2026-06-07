import { writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  claim_task_lease,
  classify_task_error,
  fail_task_attempt,
  parse_local_task,
  start_task_attempt,
  type LocalTask,
} from '../../src/domain/local-task.js';
import {
  claim_task,
  create_task,
  find_next_claimable_task,
  get_task,
  list_tasks,
  save_task,
} from '../../src/storage/task-repo.js';
import { task_json_path } from '../../src/storage/paths.js';
import { create_temp_dir } from '../source-test-helpers.js';

function task(overrides: Partial<LocalTask> = {}): LocalTask {
  return parse_local_task({
    task_id: 'task_20260603_source-process',
    type: 'source.process',
    status: 'pending',
    payload: {
      type: 'source.process',
      input: { source_id: 'src_20260514_upload_markdown_test-source' },
    },
    retry_policy: { max_attempts: 2, retry_delay_ms: 0 },
    attempts: [],
    created_at: '2026-06-03T00:00:00.000Z',
    updated_at: '2026-06-03T00:00:00.000Z',
    result_ref: null,
    ...overrides,
  });
}

describe('task repo', () => {
  it('saves reads and lists tasks through storage paths', async () => {
    const cwd = await create_temp_dir();
    const first = task();
    const second = task({
      task_id: 'task_20260604_note-index',
      type: 'note.index',
      payload: {
        type: 'note.index',
        input: { note_id: 'note_20260514_test-note' },
      },
      created_at: '2026-06-04T00:00:00.000Z',
      updated_at: '2026-06-04T00:00:00.000Z',
    });

    await create_task(first, { cwd });
    await create_task(second, { cwd });

    expect(task_json_path(first.task_id, { cwd })).toContain(
      'knowledge/tasks/2026/06/task_20260603_source-process.json',
    );
    await expect(get_task(first.task_id, { cwd })).resolves.toEqual(first);
    await expect(list_tasks({ cwd })).resolves.toEqual([second, first]);
  });

  it('updates existing tasks', async () => {
    const cwd = await create_temp_dir();
    await create_task(task(), { cwd });

    const updated = await save_task(
      task({ status: 'cancelled', updated_at: '2026-06-03T00:01:00.000Z' }),
      { cwd },
    );

    await expect(get_task(updated.task_id, { cwd })).resolves.toEqual(updated);
  });

  it('rejects duplicate and invalid task JSON', async () => {
    const cwd = await create_temp_dir();
    const created = await create_task(task(), { cwd });

    await expect(create_task(created, { cwd })).rejects.toMatchObject({
      code: 'ALREADY_EXISTS',
    });
    await writeFile(
      task_json_path(created.task_id, { cwd }),
      '{"bad": true}',
      'utf8',
    );
    await expect(get_task(created.task_id, { cwd })).rejects.toBeDefined();
  });

  it('claims a daemon eligible task and persists a lease', async () => {
    const cwd = await create_temp_dir();
    const created = await create_task(task(), { cwd });

    const claimed = await claim_task(
      {
        task_id: created.task_id,
        owner_id: 'daemon-a',
        now: '2026-06-03T00:01:00.000Z',
        lease_timeout_ms: 30_000,
      },
      { cwd },
    );

    expect(claimed?.lease).toMatchObject({ owner_id: 'daemon-a' });
    await expect(get_task(created.task_id, { cwd })).resolves.toMatchObject({
      lease: expect.objectContaining({ owner_id: 'daemon-a' }),
    });
  });

  it('prevents duplicate claims while a lease is active', async () => {
    const cwd = await create_temp_dir();
    const created = await create_task(task(), { cwd });

    const first = await claim_task(
      {
        task_id: created.task_id,
        owner_id: 'daemon-a',
        now: '2026-06-03T00:01:00.000Z',
        lease_timeout_ms: 30_000,
      },
      { cwd },
    );
    const second = await claim_task(
      {
        task_id: created.task_id,
        owner_id: 'daemon-b',
        now: '2026-06-03T00:01:10.000Z',
        lease_timeout_ms: 30_000,
      },
      { cwd },
    );

    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it('allows stale leases to be reclaimed', async () => {
    const cwd = await create_temp_dir();
    const leased = claim_task_lease({
      task: task(),
      owner_id: 'daemon-a',
      now: '2026-06-03T00:01:00.000Z',
      lease_timeout_ms: 30_000,
    });
    await create_task(leased, { cwd });

    const claimed = await claim_task(
      {
        task_id: leased.task_id,
        owner_id: 'daemon-b',
        now: '2026-06-03T00:01:30.000Z',
        lease_timeout_ms: 30_000,
      },
      { cwd },
    );

    expect(claimed?.lease).toMatchObject({ owner_id: 'daemon-b' });
  });

  it('finds the next claimable task and skips not-yet-due retries', async () => {
    const cwd = await create_temp_dir();
    const retryable = fail_task_attempt({
      task: start_task_attempt(
        task({ retry_policy: { max_attempts: 3, retry_delay_ms: 60_000 } }),
        '2026-06-03T00:01:00.000Z',
      ),
      now: '2026-06-03T00:02:00.000Z',
      error: classify_task_error({
        code: 'STORAGE_FAILED',
        message: 'temporary storage error',
        stage: 'storage',
      }),
    });
    const pending = task({
      task_id: 'task_20260604_source-process',
      created_at: '2026-06-04T00:00:00.000Z',
      updated_at: '2026-06-04T00:00:00.000Z',
    });
    await create_task(retryable, { cwd });
    await create_task(pending, { cwd });

    const claimed = await find_next_claimable_task(
      {
        owner_id: 'daemon-a',
        now: '2026-06-03T00:02:30.000Z',
        lease_timeout_ms: 30_000,
      },
      { cwd },
    );

    expect(claimed?.task_id).toBe(pending.task_id);
  });

  it('reads old task JSON without lease', async () => {
    const cwd = await create_temp_dir();
    const created = await create_task(task(), { cwd });
    const file_path = task_json_path(created.task_id, { cwd });
    const without_lease = { ...created } as Partial<LocalTask>;
    delete without_lease.lease;
    await writeFile(
      file_path,
      `${JSON.stringify(without_lease, null, 2)}\n`,
      'utf8',
    );

    await expect(get_task(created.task_id, { cwd })).resolves.toMatchObject({
      lease: null,
    });
  });
});
