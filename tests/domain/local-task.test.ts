import { describe, expect, it } from 'vitest';
import {
  cancel_task,
  claim_task_lease,
  classify_task_error,
  complete_task_attempt,
  fail_task_attempt,
  parse_local_task,
  start_task_attempt,
  task_is_daemon_eligible,
  task_lease_is_stale,
  task_retry_due_at,
  type LocalTask,
} from '../../src/domain/local-task.js';

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

describe('LocalTask domain', () => {
  it('parses valid local tasks', () => {
    expect(task()).toMatchObject({
      task_id: 'task_20260603_source-process',
      status: 'pending',
      type: 'source.process',
    });
  });

  it('rejects invalid payload type and task ids', () => {
    expect(() => task({ task_id: 'bad_20260603_source-process' })).toThrow(
      'local task id must start with task_',
    );
    expect(() =>
      task({
        payload: {
          type: 'note.index',
          input: { note_id: 'note_20260514_test-note' },
        },
      }),
    ).toThrow('local task payload type must match task type');
  });

  it('records attempts and completes successfully', () => {
    const running = start_task_attempt(task(), '2026-06-03T00:01:00.000Z');
    const completed = complete_task_attempt({
      task: running,
      now: '2026-06-03T00:02:00.000Z',
      result_summary: 'processed source',
      result_ref: 'source:src_20260514_upload_markdown_test-source',
    });

    expect(completed.status).toBe('succeeded');
    expect(completed.attempts).toHaveLength(1);
    expect(completed.attempts[0]).toMatchObject({
      attempt_number: 1,
      status: 'succeeded',
      result_summary: 'processed source',
    });
  });

  it('classifies retryable and non-retryable failures', () => {
    expect(
      classify_task_error({
        code: 'AGENT_FAILED',
        message: 'temporary model error',
        stage: 'agent',
      }),
    ).toMatchObject({ retryable: true });
    expect(
      classify_task_error({
        code: 'INVALID_STATE',
        message: 'not ready',
        stage: 'workflow',
      }),
    ).toMatchObject({ retryable: false });
  });

  it('moves retryable failures to retryable_failed while attempts remain', () => {
    const failed = fail_task_attempt({
      task: start_task_attempt(task(), '2026-06-03T00:01:00.000Z'),
      now: '2026-06-03T00:02:00.000Z',
      error: classify_task_error({
        code: 'STORAGE_FAILED',
        message: 'temporary storage error',
        stage: 'storage',
      }),
    });

    expect(failed.status).toBe('retryable_failed');
    expect(failed.attempts[0].error?.retryable).toBe(true);
  });

  it('moves failures to failed when max attempts are exhausted', () => {
    const first_failure = fail_task_attempt({
      task: start_task_attempt(task(), '2026-06-03T00:01:00.000Z'),
      now: '2026-06-03T00:02:00.000Z',
      error: classify_task_error({
        code: 'STORAGE_FAILED',
        message: 'temporary storage error',
        stage: 'storage',
      }),
    });
    const second_failure = fail_task_attempt({
      task: start_task_attempt(first_failure, '2026-06-03T00:03:00.000Z'),
      now: '2026-06-03T00:04:00.000Z',
      error: classify_task_error({
        code: 'STORAGE_FAILED',
        message: 'temporary storage error',
        stage: 'storage',
      }),
    });

    expect(second_failure.status).toBe('failed');
    expect(second_failure.attempts).toHaveLength(2);
  });

  it('rejects invalid status transitions', () => {
    const completed = complete_task_attempt({
      task: start_task_attempt(task(), '2026-06-03T00:01:00.000Z'),
      now: '2026-06-03T00:02:00.000Z',
      result_summary: 'done',
    });

    expect(() =>
      start_task_attempt(completed, '2026-06-03T00:03:00.000Z'),
    ).toThrow('invalid task status transition');
    expect(() => cancel_task(completed, '2026-06-03T00:03:00.000Z')).toThrow(
      'invalid task status transition',
    );
  });

  it('parses old task JSON without lease and validates task leases', () => {
    expect(task().lease).toBeNull();

    const claimed = claim_task_lease({
      task: task(),
      owner_id: 'daemon-a',
      now: '2026-06-03T00:01:00.000Z',
      lease_timeout_ms: 30_000,
    });

    expect(claimed.lease).toEqual({
      owner_id: 'daemon-a',
      claimed_at: '2026-06-03T00:01:00.000Z',
      expires_at: '2026-06-03T00:01:30.000Z',
    });
    expect(() =>
      claim_task_lease({
        task: task(),
        owner_id: '',
        now: '2026-06-03T00:01:00.000Z',
        lease_timeout_ms: 30_000,
      }),
    ).toThrow('local task lease owner is required');
  });

  it('detects stale leases', () => {
    const claimed = claim_task_lease({
      task: task(),
      owner_id: 'daemon-a',
      now: '2026-06-03T00:01:00.000Z',
      lease_timeout_ms: 30_000,
    });

    expect(task_lease_is_stale(claimed, '2026-06-03T00:01:29.999Z')).toBe(
      false,
    );
    expect(task_lease_is_stale(claimed, '2026-06-03T00:01:30.000Z')).toBe(true);
  });

  it('calculates retry due time and daemon eligibility', () => {
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

    expect(task_retry_due_at(retryable)).toBe('2026-06-03T00:03:00.000Z');
    expect(
      task_is_daemon_eligible({
        task: retryable,
        now: '2026-06-03T00:02:59.999Z',
      }),
    ).toBe(false);
    expect(
      task_is_daemon_eligible({
        task: retryable,
        now: '2026-06-03T00:03:00.000Z',
      }),
    ).toBe(true);
    expect(
      task_is_daemon_eligible({
        task: { ...retryable, status: 'failed' },
        now: '2026-06-03T00:03:00.000Z',
      }),
    ).toBe(false);
  });

  it('blocks daemon eligibility while a lease is active', () => {
    const claimed = claim_task_lease({
      task: task(),
      owner_id: 'daemon-a',
      now: '2026-06-03T00:01:00.000Z',
      lease_timeout_ms: 30_000,
    });

    expect(
      task_is_daemon_eligible({
        task: claimed,
        now: '2026-06-03T00:01:29.999Z',
      }),
    ).toBe(false);
    expect(
      task_is_daemon_eligible({
        task: claimed,
        now: '2026-06-03T00:01:30.000Z',
      }),
    ).toBe(true);
  });
});
