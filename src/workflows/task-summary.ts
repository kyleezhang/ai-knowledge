import type { LocalTask } from '../domain/local-task.js';

export type TaskSummary = {
  task_id: string;
  type: LocalTask['type'];
  status: LocalTask['status'];
  attempts: number;
  updated_at: string;
  last_error: LocalTask['attempts'][number]['error'] | null;
};

export function summarize_task(task: LocalTask): TaskSummary {
  return {
    task_id: task.task_id,
    type: task.type,
    status: task.status,
    attempts: task.attempts.length,
    updated_at: task.updated_at,
    last_error: task.attempts.at(-1)?.error ?? null,
  };
}
