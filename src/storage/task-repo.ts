import {
  access,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import {
  LocalTaskSchema,
  claim_task_lease,
  parse_local_task,
  task_is_daemon_eligible,
  task_lease_is_stale,
  type LocalTask,
} from '../domain/local-task.js';
import type { StorageConfig } from './config.js';
import { StorageError } from './errors.js';
import { write_json } from './json-store.js';
import { task_json_path, tasks_root } from './paths.js';

export type TaskRepoContext = {
  config?: Partial<StorageConfig>;
  cwd?: string;
};

export type ClaimTaskInput = {
  task_id: string;
  owner_id: string;
  now: string;
  lease_timeout_ms: number;
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
  return read_task_json(file_path);
}

export async function claim_task(
  input: ClaimTaskInput,
  context: TaskRepoContext = {},
): Promise<LocalTask | null> {
  const file_path = task_json_path(input.task_id, context);
  if (!(await exists(file_path))) {
    throw new StorageError({
      code: 'NOT_FOUND',
      message: `Task not found: ${input.task_id}`,
      path: file_path,
    });
  }

  const claim_path = `${file_path}.claim`;
  try {
    await writeFile(claim_path, input.now, { encoding: 'utf8', flag: 'wx' });
  } catch (error) {
    if (is_file_exists_error(error)) {
      return null;
    }
    throw new StorageError({
      code: 'WRITE_FAILED',
      message: `Failed to claim task: ${input.task_id}`,
      path: claim_path,
      cause: error,
    });
  }

  try {
    const task = await get_task(input.task_id, context);
    if (task.lease !== null && !task_lease_is_stale(task, input.now)) {
      return null;
    }
    const claimed = claim_task_lease({
      task,
      owner_id: input.owner_id,
      now: input.now,
      lease_timeout_ms: input.lease_timeout_ms,
    });
    const temp_path = `${file_path}.${input.owner_id}.tmp`;
    await writeFile(
      temp_path,
      `${JSON.stringify(LocalTaskSchema.parse(claimed), null, 2)}\n`,
      'utf8',
    );
    try {
      await rename(temp_path, file_path);
    } catch (error) {
      await rm(temp_path, { force: true });
      throw error;
    }
    return claimed;
  } catch (error) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError({
      code: 'WRITE_FAILED',
      message: `Failed to claim task: ${input.task_id}`,
      path: file_path,
      cause: error,
    });
  } finally {
    await rm(claim_path, { force: true });
  }
}

export async function find_next_claimable_task(
  input: Omit<ClaimTaskInput, 'task_id'>,
  context: TaskRepoContext = {},
): Promise<LocalTask | null> {
  const tasks = await list_tasks(context);
  for (const task of tasks.slice().reverse()) {
    if (!task_is_daemon_eligible({ task, now: input.now })) {
      continue;
    }
    const claimed = await claim_task(
      { ...input, task_id: task.task_id },
      context,
    );
    if (claimed !== null) {
      return claimed;
    }
  }
  return null;
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
    files.map(async (file_path) => read_task_json(file_path)),
  );
  return tasks.sort((left, right) =>
    right.created_at.localeCompare(left.created_at),
  );
}

async function read_task_json(file_path: string): Promise<LocalTask> {
  let raw: string;
  try {
    raw = await readFile(file_path, 'utf8');
  } catch (error) {
    throw new StorageError({
      code: 'READ_FAILED',
      message: `Failed to read JSON: ${file_path}`,
      path: file_path,
      cause: error,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new StorageError({
      code: 'JSON_PARSE_FAILED',
      message: `Failed to parse JSON: ${file_path}`,
      path: file_path,
      cause: error,
    });
  }

  try {
    return parse_local_task(parsed);
  } catch (error) {
    throw new StorageError({
      code: 'SCHEMA_PARSE_FAILED',
      message: `JSON schema validation failed: ${file_path}`,
      path: file_path,
      cause: error,
    });
  }
}

async function exists(file_path: string): Promise<boolean> {
  try {
    await access(file_path);
    return true;
  } catch {
    return false;
  }
}

function is_file_exists_error(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'EEXIST'
  );
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
