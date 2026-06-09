import { describe, expect, it } from 'vitest';
import {
  calculate_next_run_at,
  create_schedule_id,
  disable_schedule,
  parse_local_schedule,
  schedule_is_due,
  type LocalSchedule,
} from '../../src/domain/local-schedule.js';

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

describe('LocalSchedule domain', () => {
  it('parses valid collection and auto advancement schedules', () => {
    expect(schedule()).toMatchObject({
      schedule_id: 'sch_20260609_candidate-collect_github-trending',
      type: 'candidate.collect',
      status: 'enabled',
    });
    expect(
      schedule({
        schedule_id: 'sch_20260609_auto-advance_safe-defaults',
        type: 'auto.advance',
        policy: {
          mode: 'enqueue',
          allowed_task_types: ['source.process', 'note.index'],
        },
      }),
    ).toMatchObject({ type: 'auto.advance' });
  });

  it('rejects invalid ids and unsafe payload fields', () => {
    expect(() => schedule({ schedule_id: 'bad_20260609_schedule' })).toThrow(
      'local schedule id must start with sch_',
    );
    expect(() =>
      schedule({
        policy: { provider: 'github-trending', api_key: 'secret' } as never,
      }),
    ).toThrow('unsafe schedule payload field: policy.api_key');
  });

  it('creates deterministic schedule ids', () => {
    expect(
      create_schedule_id({
        date: new Date('2026-06-09T00:00:00.000Z'),
        type: 'auto.advance',
        slug: 'Safe Defaults',
      }),
    ).toBe('sch_20260609_auto-advance_safe-defaults');
  });

  it('calculates interval and daily next run times', () => {
    expect(
      calculate_next_run_at({
        rule: { kind: 'interval_minutes', interval_minutes: 15 },
        from: new Date('2026-06-09T00:00:00.000Z'),
      }),
    ).toBe('2026-06-09T00:15:00.000Z');
    expect(
      calculate_next_run_at({
        rule: { kind: 'daily_time', daily_time: '08:30' },
        from: new Date('2026-06-09T07:00:00.000Z'),
      }),
    ).toBe('2026-06-09T08:30:00.000Z');
    expect(
      calculate_next_run_at({
        rule: { kind: 'daily_time', daily_time: '08:30' },
        from: new Date('2026-06-09T09:00:00.000Z'),
      }),
    ).toBe('2026-06-10T08:30:00.000Z');
  });

  it('detects due schedules and ignores disabled schedules', () => {
    const due = schedule({ next_run_at: '2026-06-09T00:59:59.000Z' });
    const disabled = disable_schedule(due, '2026-06-09T00:30:00.000Z');

    expect(
      schedule_is_due({ schedule: due, now: '2026-06-09T01:00:00.000Z' }),
    ).toBe(true);
    expect(
      schedule_is_due({ schedule: disabled, now: '2026-06-09T01:00:00.000Z' }),
    ).toBe(false);
  });
});
