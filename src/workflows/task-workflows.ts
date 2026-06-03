import { createHash } from 'node:crypto';
import type { EmbeddingProvider } from '../agents/embedding-provider.js';
import type { LlmClient } from '../agents/types.js';
import {
  classify_task_error,
  complete_task_attempt,
  fail_task_attempt,
  parse_local_task,
  start_task_attempt,
  type LocalTask,
  type RetryPolicy,
  type TaskPayload,
} from '../domain/local-task.js';
import type { StorageConfig } from '../storage/config.js';
import { StorageError } from '../storage/errors.js';
import {
  create_task,
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

export type TaskWorkflowInput = {
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
  now?: Date;
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
  const task =
    input.task_id === undefined
      ? await find_next_runnable_task(context)
      : await get_task(input.task_id, context);
  if (task === null) {
    return {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'No runnable task found.' },
    };
  }
  if (task.status !== 'pending' && task.status !== 'retryable_failed') {
    return {
      ok: false,
      error: {
        code: 'INVALID_STATE',
        message: `Task is not runnable. Current status: ${task.status}`,
      },
    };
  }

  const started_at = (input.now ?? new Date()).toISOString();
  let running = start_task_attempt(task, started_at);
  running = await save_task(running, context);
  const result = await run_local_task_payload({
    task: running,
    storage_config: input.storage_config,
    cwd: input.cwd,
    llm_client: input.llm_client,
    embedding_provider: input.embedding_provider,
  });
  const finished_at = (input.now ?? new Date()).toISOString();
  const completed = result.ok
    ? complete_task_attempt({
        task: running,
        now: finished_at,
        result_summary: result.data.result_summary,
        result_ref: result.data.result_ref,
      })
    : fail_task_attempt({
        task: running,
        now: finished_at,
        error: classify_task_error({
          code: result.error.code,
          message: result.error.message,
          stage: 'workflow',
        }),
      });
  const saved = await save_task(completed, context);
  return { ok: true, data: { task: saved, summary: summarize_task(saved) } };
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

async function find_next_runnable_task(context: {
  config?: Partial<StorageConfig>;
  cwd?: string;
}): Promise<LocalTask | null> {
  const tasks = await list_tasks(context);
  return (
    tasks
      .slice()
      .reverse()
      .find(
        (task) =>
          task.status === 'pending' || task.status === 'retryable_failed',
      ) ?? null
  );
}

function create_task_id(payload: TaskPayload, now: Date): string {
  const date = now.toISOString().slice(0, 10).replaceAll('-', '');
  const hash = createHash('sha1')
    .update(JSON.stringify(payload))
    .digest('hex')
    .slice(0, 8);
  return `task_${date}_${payload.type.replace('.', '-')}-${hash}`;
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
