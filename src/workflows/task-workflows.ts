import { createHash } from 'node:crypto';
import type { EmbeddingProvider } from '../agents/embedding-provider.js';
import type { LlmClient } from '../agents/types.js';
import {
  classify_task_error,
  complete_task_attempt,
  fail_task_attempt,
  parse_local_task,
  start_task_attempt,
  task_is_daemon_eligible,
  type LocalTask,
  type RetryPolicy,
  type TaskPayload,
} from '../domain/local-task.js';
import type { StorageConfig } from '../storage/config.js';
import { StorageError } from '../storage/errors.js';
import {
  claim_task,
  create_task,
  find_next_claimable_task,
  get_task,
  list_tasks,
  save_task,
} from '../storage/task-repo.js';
import { run_local_task_payload } from './local-task-runner.js';
import { summarize_task, type TaskSummary } from './task-summary.js';
import type { WorkflowResult } from './types.js';

const default_retry_policy: RetryPolicy = {
  max_attempts: 2,
  retry_delay_ms: 0,
};

const default_daemon_options = {
  max_runs: Number.POSITIVE_INFINITY,
  idle_exit_after: Number.POSITIVE_INFINITY,
  poll_interval_ms: 1_000,
  lease_timeout_ms: 5 * 60_000,
};

export type TaskWorkflowInput = {
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
  now?: Date;
};

export type TaskDaemonExitReason = 'max_runs_reached' | 'idle_exit' | 'stopped';

export type TaskDaemonRun = {
  task_id: string;
  type: LocalTask['type'];
  status: LocalTask['status'];
  attempts: number;
};

export type TaskDaemonSummary = {
  owner_id: string;
  started_at: string;
  finished_at: string;
  exit_reason: TaskDaemonExitReason;
  runs: TaskDaemonRun[];
  idle_cycles: number;
};

export type TaskDaemonInput = TaskWorkflowInput & {
  owner_id?: string;
  max_runs?: number;
  idle_exit_after?: number;
  poll_interval_ms?: number;
  lease_timeout_ms?: number;
  should_stop?: () => boolean;
  wait?: (milliseconds: number) => Promise<void>;
  llm_client?: LlmClient;
  embedding_provider?: EmbeddingProvider;
};

export async function enqueue_task_workflow(
  input: TaskWorkflowInput & {
    payload: TaskPayload;
    retry_policy?: RetryPolicy;
  },
): Promise<WorkflowResult<{ task: LocalTask; summary: TaskSummary }>> {
  const timestamp = (input.now ?? new Date()).toISOString();
  const task = parse_local_task({
    task_id: create_task_id(input.payload, input.now ?? new Date()),
    type: input.payload.type,
    status: 'pending',
    payload: input.payload,
    retry_policy: input.retry_policy ?? default_retry_policy,
    attempts: [],
    created_at: timestamp,
    updated_at: timestamp,
    result_ref: null,
  });
  try {
    const created = await create_task(task, {
      config: input.storage_config,
      cwd: input.cwd,
    });
    return {
      ok: true,
      data: { task: created, summary: summarize_task(created) },
    };
  } catch (error) {
    return storage_error(error);
  }
}

export async function run_task_workflow(
  input: TaskWorkflowInput & {
    task_id?: string;
    llm_client?: LlmClient;
    embedding_provider?: EmbeddingProvider;
  },
): Promise<WorkflowResult<{ task: LocalTask; summary: TaskSummary }>> {
  const context = { config: input.storage_config, cwd: input.cwd };
  const now = (input.now ?? new Date()).toISOString();
  const lease_timeout_ms = default_daemon_options.lease_timeout_ms;
  let task: LocalTask | null;
  if (input.task_id === undefined) {
    task = await find_next_claimable_task(
      { owner_id: 'manual-task-run', now, lease_timeout_ms },
      context,
    );
  } else {
    const candidate = await get_task(input.task_id, context);
    if (!task_is_daemon_eligible({ task: candidate, now })) {
      return {
        ok: false,
        error: {
          code: 'INVALID_STATE',
          message: `Task is not runnable. Current status: ${candidate.status}`,
        },
      };
    }
    task = await claim_task(
      {
        task_id: input.task_id,
        owner_id: 'manual-task-run',
        now,
        lease_timeout_ms,
      },
      context,
    );
  }
  if (task === null) {
    return {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'No runnable task found.' },
    };
  }
  return run_claimed_task({
    task,
    started_at: now,
    finished_at: now,
    storage_config: input.storage_config,
    cwd: input.cwd,
    llm_client: input.llm_client,
    embedding_provider: input.embedding_provider,
  });
}

export async function run_task_daemon_workflow(
  input: TaskDaemonInput,
): Promise<WorkflowResult<{ summary: TaskDaemonSummary }>> {
  const context = { config: input.storage_config, cwd: input.cwd };
  const started_at = (input.now ?? new Date()).toISOString();
  const owner_id = input.owner_id ?? `task-daemon-${process.pid}`;
  const max_runs = input.max_runs ?? default_daemon_options.max_runs;
  const idle_exit_after =
    input.idle_exit_after ?? default_daemon_options.idle_exit_after;
  const poll_interval_ms =
    input.poll_interval_ms ?? default_daemon_options.poll_interval_ms;
  const lease_timeout_ms =
    input.lease_timeout_ms ?? default_daemon_options.lease_timeout_ms;
  const wait = input.wait ?? default_wait;
  const runs: TaskDaemonRun[] = [];
  let idle_cycles = 0;
  let exit_reason: TaskDaemonExitReason = 'stopped';

  while (true) {
    if (input.should_stop?.() === true) {
      exit_reason = 'stopped';
      break;
    }
    if (runs.length >= max_runs) {
      exit_reason = 'max_runs_reached';
      break;
    }

    const now = (input.now ?? new Date()).toISOString();
    const task = await find_next_claimable_task(
      { owner_id, now, lease_timeout_ms },
      context,
    );

    if (task === null) {
      idle_cycles += 1;
      if (idle_cycles >= idle_exit_after) {
        exit_reason = 'idle_exit';
        break;
      }
      await wait(poll_interval_ms);
      continue;
    }

    idle_cycles = 0;
    const result = await run_claimed_task({
      task,
      started_at: now,
      finished_at: (input.now ?? new Date()).toISOString(),
      storage_config: input.storage_config,
      cwd: input.cwd,
      llm_client: input.llm_client,
      embedding_provider: input.embedding_provider,
    });
    if (!result.ok) {
      return result;
    }
    runs.push({
      task_id: result.data.task.task_id,
      type: result.data.task.type,
      status: result.data.task.status,
      attempts: result.data.task.attempts.length,
    });
  }

  return {
    ok: true,
    data: {
      summary: {
        owner_id,
        started_at,
        finished_at: (input.now ?? new Date()).toISOString(),
        exit_reason,
        runs,
        idle_cycles,
      },
    },
  };
}

export async function retry_task_workflow(
  input: TaskWorkflowInput & { task_id: string },
): Promise<WorkflowResult<{ task: LocalTask; summary: TaskSummary }>> {
  const context = { config: input.storage_config, cwd: input.cwd };
  const task = await get_task(input.task_id, context);
  if (task.status !== 'retryable_failed') {
    return {
      ok: false,
      error: {
        code: 'INVALID_STATE',
        message: `Task is not retryable. Current status: ${task.status}`,
      },
    };
  }
  return { ok: true, data: { task, summary: summarize_task(task) } };
}

export async function list_tasks_workflow(
  input: TaskWorkflowInput,
): Promise<WorkflowResult<{ tasks: TaskSummary[] }>> {
  const tasks = await list_tasks({
    config: input.storage_config,
    cwd: input.cwd,
  });
  return { ok: true, data: { tasks: tasks.map(summarize_task) } };
}

export async function show_task_workflow(
  input: TaskWorkflowInput & { task_id: string },
): Promise<WorkflowResult<{ task: LocalTask; summary: TaskSummary }>> {
  try {
    const task = await get_task(input.task_id, {
      config: input.storage_config,
      cwd: input.cwd,
    });
    return { ok: true, data: { task, summary: summarize_task(task) } };
  } catch (error) {
    return storage_error(error);
  }
}

async function run_claimed_task(input: {
  task: LocalTask;
  started_at: string;
  finished_at: string;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
  llm_client?: LlmClient;
  embedding_provider?: EmbeddingProvider;
}): Promise<WorkflowResult<{ task: LocalTask; summary: TaskSummary }>> {
  const context = { config: input.storage_config, cwd: input.cwd };
  let running = start_task_attempt(input.task, input.started_at);
  running = await save_task(running, context);
  const result = await run_local_task_payload({
    task: running,
    storage_config: input.storage_config,
    cwd: input.cwd,
    llm_client: input.llm_client,
    embedding_provider: input.embedding_provider,
  });
  const completed = result.ok
    ? complete_task_attempt({
        task: running,
        now: input.finished_at,
        result_summary: result.data.result_summary,
        result_ref: result.data.result_ref,
      })
    : fail_task_attempt({
        task: running,
        now: input.finished_at,
        error: classify_task_error({
          code: result.error.code,
          message: result.error.message,
          stage: 'workflow',
        }),
      });
  const saved = await save_task(completed, context);
  return { ok: true, data: { task: saved, summary: summarize_task(saved) } };
}

function create_task_id(payload: TaskPayload, now: Date): string {
  const date = now.toISOString().slice(0, 10).replaceAll('-', '');
  const hash = createHash('sha1')
    .update(JSON.stringify(payload))
    .digest('hex')
    .slice(0, 8);
  return `task_${date}_${payload.type.replace('.', '-')}-${hash}`;
}

async function default_wait(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function storage_error<T>(error: unknown): WorkflowResult<T> {
  if (error instanceof StorageError && error.code === 'NOT_FOUND') {
    return {
      ok: false,
      error: { code: 'NOT_FOUND', message: error.message, cause: error },
    };
  }
  return {
    ok: false,
    error: {
      code: error instanceof StorageError ? 'STORAGE_FAILED' : 'UNKNOWN',
      message: error instanceof Error ? error.message : 'Task workflow failed.',
      cause: error,
    },
  };
}
