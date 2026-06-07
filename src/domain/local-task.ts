import { z } from 'zod';

export const TaskStatusSchema = z.enum([
  'pending',
  'running',
  'succeeded',
  'retryable_failed',
  'failed',
  'cancelled',
]);

export const TaskTypeSchema = z.enum([
  'source.process',
  'source.understand',
  'note.index',
  'note.vector_index',
]);

const SourceProcessPayloadSchema = z.object({
  source_id: z.string(),
});

const SourceUnderstandPayloadSchema = z.object({
  source_id: z.string(),
});

const NoteIndexPayloadSchema = z.object({
  note_id: z.string(),
});

const NoteVectorIndexPayloadSchema = z.object({
  note_id: z.string(),
});

export const TaskPayloadSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('source.process'),
    input: SourceProcessPayloadSchema,
  }),
  z.object({
    type: z.literal('source.understand'),
    input: SourceUnderstandPayloadSchema,
  }),
  z.object({ type: z.literal('note.index'), input: NoteIndexPayloadSchema }),
  z.object({
    type: z.literal('note.vector_index'),
    input: NoteVectorIndexPayloadSchema,
  }),
]);

export const RetryPolicySchema = z.object({
  max_attempts: z.number().int().positive(),
  retry_delay_ms: z.number().int().nonnegative(),
});

export const TaskLeaseSchema = z.object({
  owner_id: z.string(),
  claimed_at: z.string(),
  expires_at: z.string(),
});

export const TaskErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  stage: z.string(),
  retryable: z.boolean(),
});

export const TaskAttemptSchema = z.object({
  attempt_number: z.number().int().positive(),
  status: z.enum(['running', 'succeeded', 'failed']),
  started_at: z.string(),
  finished_at: z.string().nullable(),
  error: TaskErrorSchema.nullable(),
  result_summary: z.string().nullable(),
});

export const LocalTaskSchema = z.object({
  task_id: z.string(),
  type: TaskTypeSchema,
  status: TaskStatusSchema,
  payload: TaskPayloadSchema,
  retry_policy: RetryPolicySchema,
  attempts: z.array(TaskAttemptSchema),
  created_at: z.string(),
  updated_at: z.string(),
  result_ref: z.string().nullable(),
  lease: TaskLeaseSchema.nullable().optional().default(null),
});

export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type TaskType = z.infer<typeof TaskTypeSchema>;
export type TaskPayload = z.infer<typeof TaskPayloadSchema>;
export type RetryPolicy = z.infer<typeof RetryPolicySchema>;
export type TaskLease = z.infer<typeof TaskLeaseSchema>;
export type TaskError = z.infer<typeof TaskErrorSchema>;
export type TaskAttempt = z.infer<typeof TaskAttemptSchema>;
export type LocalTask = z.infer<typeof LocalTaskSchema>;

export function parse_local_task(value: unknown): LocalTask {
  const task = LocalTaskSchema.parse(value);
  validate_local_task(task);
  return task;
}

export function validate_local_task(task: LocalTask): void {
  if (task.task_id.trim().length === 0) {
    throw new Error('local task must have task_id');
  }
  if (!task.task_id.startsWith('task_')) {
    throw new Error('local task id must start with task_');
  }
  if (task.payload.type !== task.type) {
    throw new Error('local task payload type must match task type');
  }
  if (
    task.created_at.trim().length === 0 ||
    task.updated_at.trim().length === 0
  ) {
    throw new Error('local task must have timestamps');
  }
  if (task.lease !== null) {
    if (task.lease.owner_id.trim().length === 0) {
      throw new Error('local task lease must have owner_id');
    }
    if (
      task.lease.claimed_at.trim().length === 0 ||
      task.lease.expires_at.trim().length === 0
    ) {
      throw new Error('local task lease must have timestamps');
    }
  }
  validate_attempts(task.attempts);
  if (task.attempts.length > task.retry_policy.max_attempts) {
    throw new Error('local task attempts exceed max_attempts');
  }
}

export function start_task_attempt(task: LocalTask, now: string): LocalTask {
  assert_task_transition(task.status, 'running');
  const attempt: TaskAttempt = {
    attempt_number: task.attempts.length + 1,
    status: 'running',
    started_at: now,
    finished_at: null,
    error: null,
    result_summary: null,
  };
  return parse_local_task({
    ...task,
    status: 'running',
    attempts: [...task.attempts, attempt],
    updated_at: now,
  });
}

export function claim_task_lease(input: {
  task: LocalTask;
  owner_id: string;
  now: string;
  lease_timeout_ms: number;
}): LocalTask {
  if (input.owner_id.trim().length === 0) {
    throw new Error('local task lease owner is required');
  }
  if (input.lease_timeout_ms <= 0) {
    throw new Error('local task lease timeout must be positive');
  }
  const now_ms = Date.parse(input.now);
  return parse_local_task({
    ...input.task,
    lease: {
      owner_id: input.owner_id,
      claimed_at: input.now,
      expires_at: new Date(now_ms + input.lease_timeout_ms).toISOString(),
    },
    updated_at: input.now,
  });
}

export function clear_task_lease(task: LocalTask, now: string): LocalTask {
  return parse_local_task({ ...task, lease: null, updated_at: now });
}

export function task_lease_is_stale(task: LocalTask, now: string): boolean {
  return (
    task.lease !== null && Date.parse(task.lease.expires_at) <= Date.parse(now)
  );
}

export function task_retry_due_at(task: LocalTask): string | null {
  const last_attempt = task.attempts.at(-1);
  if (
    task.status !== 'retryable_failed' ||
    last_attempt?.finished_at === null
  ) {
    return null;
  }
  if (last_attempt === undefined) {
    return null;
  }
  return new Date(
    Date.parse(last_attempt.finished_at) + task.retry_policy.retry_delay_ms,
  ).toISOString();
}

export function task_is_daemon_eligible(input: {
  task: LocalTask;
  now: string;
}): boolean {
  if (
    input.task.lease !== null &&
    !task_lease_is_stale(input.task, input.now)
  ) {
    return false;
  }
  if (input.task.status === 'pending') {
    return true;
  }
  if (input.task.status !== 'retryable_failed') {
    return false;
  }
  if (input.task.attempts.length >= input.task.retry_policy.max_attempts) {
    return false;
  }
  const retry_due_at = task_retry_due_at(input.task);
  return (
    retry_due_at !== null && Date.parse(retry_due_at) <= Date.parse(input.now)
  );
}

export function complete_task_attempt(input: {
  task: LocalTask;
  now: string;
  result_summary: string;
  result_ref?: string | null;
}): LocalTask {
  const attempt = current_running_attempt(input.task);
  return parse_local_task({
    ...input.task,
    status: 'succeeded',
    attempts: replace_current_attempt(input.task, {
      ...attempt,
      status: 'succeeded',
      finished_at: input.now,
      result_summary: input.result_summary,
    }),
    updated_at: input.now,
    result_ref: input.result_ref ?? input.task.result_ref,
    lease: null,
  });
}

export function fail_task_attempt(input: {
  task: LocalTask;
  now: string;
  error: TaskError;
}): LocalTask {
  const attempt = current_running_attempt(input.task);
  const next_status =
    input.error.retryable &&
    input.task.attempts.length < input.task.retry_policy.max_attempts
      ? 'retryable_failed'
      : 'failed';
  return parse_local_task({
    ...input.task,
    status: next_status,
    attempts: replace_current_attempt(input.task, {
      ...attempt,
      status: 'failed',
      finished_at: input.now,
      error: input.error,
    }),
    updated_at: input.now,
    lease: null,
  });
}

export function cancel_task(task: LocalTask, now: string): LocalTask {
  assert_task_transition(task.status, 'cancelled');
  return parse_local_task({ ...task, status: 'cancelled', updated_at: now });
}

export function classify_task_error(input: {
  code: string;
  message: string;
  stage: string;
}): TaskError {
  const retryable = ['AGENT_FAILED', 'STORAGE_FAILED', 'UNKNOWN'].includes(
    input.code,
  );
  return { ...input, retryable };
}

export function assert_task_transition(from: TaskStatus, to: TaskStatus): void {
  const allowed: Record<TaskStatus, TaskStatus[]> = {
    pending: ['running', 'cancelled'],
    running: ['succeeded', 'retryable_failed', 'failed'],
    retryable_failed: ['running', 'cancelled'],
    succeeded: [],
    failed: [],
    cancelled: [],
  };
  if (!allowed[from].includes(to)) {
    throw new Error(`invalid task status transition: ${from} -> ${to}`);
  }
}

function validate_attempts(attempts: TaskAttempt[]): void {
  attempts.forEach((attempt, index) => {
    if (attempt.attempt_number !== index + 1) {
      throw new Error('local task attempt numbers must be sequential');
    }
    if (attempt.status !== 'running' && attempt.finished_at === null) {
      throw new Error('finished task attempt must have finished_at');
    }
    if (attempt.status === 'failed' && attempt.error === null) {
      throw new Error('failed task attempt must have error');
    }
  });
}

function current_running_attempt(task: LocalTask): TaskAttempt {
  const attempt = task.attempts.at(-1);
  if (
    task.status !== 'running' ||
    attempt === undefined ||
    attempt.status !== 'running'
  ) {
    throw new Error('local task must have a running attempt');
  }
  return attempt;
}

function replace_current_attempt(
  task: LocalTask,
  attempt: TaskAttempt,
): TaskAttempt[] {
  return [...task.attempts.slice(0, -1), attempt];
}
