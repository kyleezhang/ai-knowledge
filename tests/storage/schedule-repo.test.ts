import { writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  parse_local_schedule,
  type LocalSchedule,
} from '../../src/domain/local-schedule.js';
import {
  create_schedule,
  get_schedule,
  list_schedules,
  save_schedule,
} from '../../src/storage/schedule-repo.js';
import { schedule_json_path, schedules_root } from '../../src/storage/paths.js';
import { create_temp_dir } from '../source-test-helpers.js';

function schedule(overrides: Partial<LocalSchedule> = {}): LocalSchedule {
  return parse_local_schedule({
    schedule_id: 'sch_20260609_candidate-collect_github-trending',
    type: 'candidate.collect',
    status: 'enabled',
    rule: { kind: 'interval_minutes', interval_minutes: 60 },
    policy: { provider: 'github-trending' },
    created_at: '2026-06-09T00:00:00.000Z',
    updated_at: '2026-06-09T00:00:00.000Z',
    last_run_at: null,
    next_run_at: '2026-06-09T01:00:00.000Z',
    last_run_summary: null,
    ...overrides,
  });
}

describe('schedule repo', () => {
  it('saves reads and lists schedules through storage paths', async () => {
    const cwd = await create_temp_dir();
    const first = schedule();
    const second = schedule({
      schedule_id: 'sch_20260610_auto-advance_safe-defaults',
      type: 'auto.advance',
      policy: {
        mode: 'enqueue',
        allowed_task_types: ['source.process'],
      },
      created_at: '2026-06-10T00:00:00.000Z',
      updated_at: '2026-06-10T00:00:00.000Z',
      next_run_at: '2026-06-10T01:00:00.000Z',
    });

    await create_schedule(first, { cwd });
    await create_schedule(second, { cwd });

    expect(schedule_json_path(first.schedule_id, { cwd })).toContain(
      'knowledge/schedules/2026/06/sch_20260609_candidate-collect_github-trending.json',
    );
    await expect(get_schedule(first.schedule_id, { cwd })).resolves.toEqual(
      first,
    );
    await expect(list_schedules({ cwd })).resolves.toEqual([second, first]);
  });

  it('lazily creates schedules directory for old workspaces', async () => {
    const cwd = await create_temp_dir();
    await expect(list_schedules({ cwd })).resolves.toEqual([]);
    await create_schedule(schedule(), { cwd });

    expect(schedules_root({ cwd })).toContain('knowledge/schedules');
    await expect(list_schedules({ cwd })).resolves.toHaveLength(1);
  });

  it('updates existing schedules', async () => {
    const cwd = await create_temp_dir();
    await create_schedule(schedule(), { cwd });
    const updated = await save_schedule(
      schedule({
        status: 'disabled',
        updated_at: '2026-06-09T00:30:00.000Z',
      }),
      { cwd },
    );

    await expect(get_schedule(updated.schedule_id, { cwd })).resolves.toEqual(
      updated,
    );
  });

  it('rejects duplicate schedules and invalid JSON', async () => {
    const cwd = await create_temp_dir();
    const created = await create_schedule(schedule(), { cwd });

    await expect(create_schedule(created, { cwd })).rejects.toMatchObject({
      code: 'ALREADY_EXISTS',
    });
    await writeFile(
      schedule_json_path(created.schedule_id, { cwd }),
      '{"bad": true}',
      'utf8',
    );
    await expect(
      get_schedule(created.schedule_id, { cwd }),
    ).rejects.toMatchObject({
      code: 'SCHEMA_PARSE_FAILED',
    });
  });
});
