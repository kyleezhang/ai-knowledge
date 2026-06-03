import { access, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import {
  LocalTaskSchema,
  parse_local_task,
  type LocalTask,
} from '../domain/local-task.js';
import type { StorageConfig } from './config.js';
import { StorageError } from './errors.js';
import { read_json, write_json } from './json-store.js';
import { task_json_path, tasks_root } from './paths.js';

export type TaskRepoContext = {
  config?: Partial<StorageConfig>;
  cwd?: string;
};

export async function create_task(
  task: LocalTask,
  context: TaskRepoContext = {},
): Promise<LocalTask> {
  const parsed = parse_local_task(task);
  const file_path = task_json_path(parsed.task_id, context);
  if (await exists(file_path)) {
    throw new StorageError({
      code: 'ALREADY_EXISTS',
      message: `Task already exists: ${parsed.task_id}`,
      path: file_path,
    });
  }
  await mkdir(path.dirname(file_path), { recursive: true });
  await write_json({ file_path, schema: LocalTaskSchema, data: parsed });
  return parsed;
}

export async function save_task(
  task: LocalTask,
  context: TaskRepoContext = {},
): Promise<LocalTask> {
  const parsed = parse_local_task(task);
  const file_path = task_json_path(parsed.task_id, context);
  await mkdir(path.dirname(file_path), { recursive: true });
  await write_json({ file_path, schema: LocalTaskSchema, data: parsed });
  return parsed;
}

export async function get_task(
  task_id: string,
  context: TaskRepoContext = {},
): Promise<LocalTask> {
  const file_path = task_json_path(task_id, context);
  if (!(await exists(file_path))) {
    throw new StorageError({
      code: 'NOT_FOUND',
      message: `Task not found: ${task_id}`,
      path: file_path,
    });
  }
  return parse_local_task(
    await read_json({ file_path, schema: LocalTaskSchema }),
  );
}

export async function list_tasks(
  context: TaskRepoContext = {},
): Promise<LocalTask[]> {
  const root = tasks_root(context);
  if (!(await exists(root))) {
    return [];
  }
  const files = await find_task_files(root);
  const tasks = await Promise.all(
    files.map(async (file_path) =>
      parse_local_task(await read_json({ file_path, schema: LocalTaskSchema })),
    ),
  );
  return tasks.sort((left, right) =>
    right.created_at.localeCompare(left.created_at),
  );
}

async function exists(file_path: string): Promise<boolean> {
  try {
    await access(file_path);
    return true;
  } catch {
    return false;
  }
}

async function find_task_files(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entry_path = path.join(root, entry.name);
      if (entry.isDirectory()) {
        return find_task_files(entry_path);
      }
      return entry.name.endsWith('.json') ? [entry_path] : [];
    }),
  );
  return nested.flat();
}
