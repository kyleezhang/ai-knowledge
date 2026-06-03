import { writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  parse_local_task,
  type LocalTask,
} from '../../src/domain/local-task.js';
import {
  create_task,
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
});
