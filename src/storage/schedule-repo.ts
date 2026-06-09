import { access, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import {
  LocalScheduleSchema,
  parse_local_schedule,
  type LocalSchedule,
} from '../domain/local-schedule.js';
import type { StorageConfig } from './config.js';
import { StorageError } from './errors.js';
import { read_json, write_json } from './json-store.js';
import { schedule_json_path, schedules_root } from './paths.js';

export type ScheduleRepoContext = {
  config?: Partial<StorageConfig>;
  cwd?: string;
};

export async function create_schedule(
  schedule: LocalSchedule,
  context: ScheduleRepoContext = {},
): Promise<LocalSchedule> {
  const parsed = parse_local_schedule(schedule);
  const file_path = schedule_json_path(parsed.schedule_id, context);
  if (await exists(file_path)) {
    throw new StorageError({
      code: 'ALREADY_EXISTS',
      message: `Schedule already exists: ${parsed.schedule_id}`,
      path: file_path,
    });
  }
  await mkdir(path.dirname(file_path), { recursive: true });
  await write_json({ file_path, schema: LocalScheduleSchema, data: parsed });
  return parsed;
}

export async function save_schedule(
  schedule: LocalSchedule,
  context: ScheduleRepoContext = {},
): Promise<LocalSchedule> {
  const parsed = parse_local_schedule(schedule);
  const file_path = schedule_json_path(parsed.schedule_id, context);
  await mkdir(path.dirname(file_path), { recursive: true });
  await write_json({ file_path, schema: LocalScheduleSchema, data: parsed });
  return parsed;
}

export async function get_schedule(
  schedule_id: string,
  context: ScheduleRepoContext = {},
): Promise<LocalSchedule> {
  const file_path = schedule_json_path(schedule_id, context);
  if (!(await exists(file_path))) {
    throw new StorageError({
      code: 'NOT_FOUND',
      message: `Schedule not found: ${schedule_id}`,
      path: file_path,
    });
  }
  return parse_local_schedule(
    await read_json({ file_path, schema: LocalScheduleSchema }),
  );
}

export async function list_schedules(
  context: ScheduleRepoContext = {},
): Promise<LocalSchedule[]> {
  const root = schedules_root(context);
  if (!(await exists(root))) {
    return [];
  }
  const files = await find_schedule_files(root);
  const schedules = await Promise.all(
    files.map(async (file_path) =>
      parse_local_schedule(
        await read_json({ file_path, schema: LocalScheduleSchema }),
      ),
    ),
  );
  return schedules.sort((left, right) =>
    right.updated_at.localeCompare(left.updated_at),
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

async function find_schedule_files(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entry_path = path.join(root, entry.name);
      if (entry.isDirectory()) {
        return find_schedule_files(entry_path);
      }
      return entry.name.endsWith('.json') ? [entry_path] : [];
    }),
  );
  return nested.flat();
}
