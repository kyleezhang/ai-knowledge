import { z } from 'zod';
import type { CollectorResult } from '../collectors/types.js';
import {
  calculate_next_run_at,
  create_schedule_id,
  default_auto_advance_task_types,
  disable_schedule,
  enable_schedule,
  parse_local_schedule,
  record_schedule_run,
  schedule_is_due,
  type AutoAdvanceTaskType,
  type LocalSchedule,
  type ScheduleRule,
  type ScheduleRunSummary,
  type ScheduleType,
} from '../domain/local-schedule.js';
import type { TaskPayload } from '../domain/local-task.js';
import type { StorageConfig } from '../storage/config.js';
import { StorageError } from '../storage/errors.js';
import { get_index_entry } from '../storage/index-repo.js';
import { list_notes } from '../storage/note-repo.js';
import {
  create_schedule,
  get_schedule,
  list_schedules,
  save_schedule,
} from '../storage/schedule-repo.js';
import { list_sources } from '../storage/source-repo.js';
import {
  collect_candidates_workflow,
  type CandidateCollectorProvider,
} from './collect-candidates-workflow.js';
import {
  summarize_schedule,
  type ScheduleSummary,
} from './schedule-summary.js';
import {
  enqueue_task_workflow,
  find_active_task_by_payload,
} from './task-workflows.js';
import type { WorkflowResult } from './types.js';

const ScheduleCreateRuleInputSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('interval_minutes'),
    interval_minutes: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal('daily_time'),
    daily_time: z.string(),
  }),
]);

export type ScheduleWorkflowInput = {
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
  now?: Date;
};

export type ScheduleTickItem = {
  schedule_id: string;
  status: 'succeeded' | 'failed' | 'skipped';
  message: string;
  created_task_ids: string[];
};

export type ScheduleTickSummary = {
  ran_at: string;
  results: ScheduleTickItem[];
};

export type ScheduleCreateInput = ScheduleWorkflowInput & {
  type: ScheduleType;
  rule: ScheduleRule;
  provider?: CandidateCollectorProvider;
  allowed_task_types?: AutoAdvanceTaskType[];
};

export type SchedulerCollectProvider = (
  provider: CandidateCollectorProvider,
) => Promise<CollectorResult>;

export async function create_schedule_workflow(
  input: ScheduleCreateInput,
): Promise<
  WorkflowResult<{ schedule: LocalSchedule; summary: ScheduleSummary }>
> {
  try {
    const now = input.now ?? new Date();
    const timestamp = now.toISOString();
    const rule = ScheduleCreateRuleInputSchema.parse(input.rule);
    const policy = build_policy(input);
    const schedule = parse_local_schedule({
      schedule_id: create_schedule_id({
        date: now,
        type: input.type,
        slug: schedule_slug(input),
      }),
      type: input.type,
      status: 'enabled',
      rule,
      policy,
      created_at: timestamp,
      updated_at: timestamp,
      last_run_at: null,
      next_run_at: calculate_next_run_at({ rule, from: now }),
      last_run_summary: null,
    });
    const created = await create_schedule(schedule, context(input));
    return {
      ok: true,
      data: { schedule: created, summary: summarize_schedule(created) },
    };
  } catch (error) {
    return schedule_error(error, 'Failed to create schedule.');
  }
}

export async function list_schedules_workflow(
  input: ScheduleWorkflowInput,
): Promise<WorkflowResult<{ schedules: ScheduleSummary[] }>> {
  try {
    const schedules = await list_schedules(context(input));
    return {
      ok: true,
      data: { schedules: schedules.map(summarize_schedule) },
    };
  } catch (error) {
    return schedule_error(error, 'Failed to list schedules.');
  }
}

export async function show_schedule_workflow(
  input: ScheduleWorkflowInput & { schedule_id: string },
): Promise<
  WorkflowResult<{ schedule: LocalSchedule; summary: ScheduleSummary }>
> {
  try {
    const schedule = await get_schedule(input.schedule_id, context(input));
    return {
      ok: true,
      data: { schedule, summary: summarize_schedule(schedule) },
    };
  } catch (error) {
    return schedule_error(error, `Schedule not found: ${input.schedule_id}`);
  }
}

export async function enable_schedule_workflow(
  input: ScheduleWorkflowInput & { schedule_id: string },
): Promise<
  WorkflowResult<{ schedule: LocalSchedule; summary: ScheduleSummary }>
> {
  return update_schedule_status(input, 'enabled');
}

export async function disable_schedule_workflow(
  input: ScheduleWorkflowInput & { schedule_id: string },
): Promise<
  WorkflowResult<{ schedule: LocalSchedule; summary: ScheduleSummary }>
> {
  return update_schedule_status(input, 'disabled');
}

export async function scheduler_tick_workflow(
  input: ScheduleWorkflowInput & {
    collect_candidates?: SchedulerCollectProvider;
  },
): Promise<WorkflowResult<{ summary: ScheduleTickSummary }>> {
  const now = input.now ?? new Date();
  const timestamp = now.toISOString();
  try {
    const schedules = await list_schedules(context(input));
    const results: ScheduleTickItem[] = [];
    for (const schedule of schedules) {
      if (schedule.status === 'disabled') {
        results.push(skipped(schedule, 'schedule disabled'));
        continue;
      }
      if (!schedule_is_due({ schedule, now: timestamp })) {
        results.push(skipped(schedule, 'schedule not due'));
        continue;
      }
      const item = await run_due_schedule({
        schedule,
        now,
        storage_config: input.storage_config,
        cwd: input.cwd,
        collect_candidates: input.collect_candidates,
      });
      results.push(item);
    }
    return { ok: true, data: { summary: { ran_at: timestamp, results } } };
  } catch (error) {
    return schedule_error(error, 'Failed to run scheduler tick.');
  }
}

async function update_schedule_status(
  input: ScheduleWorkflowInput & { schedule_id: string },
  status: 'enabled' | 'disabled',
): Promise<
  WorkflowResult<{ schedule: LocalSchedule; summary: ScheduleSummary }>
> {
  try {
    const timestamp = (input.now ?? new Date()).toISOString();
    const schedule = await get_schedule(input.schedule_id, context(input));
    const updated =
      status === 'enabled'
        ? enable_schedule(schedule, timestamp)
        : disable_schedule(schedule, timestamp);
    const saved = await save_schedule(updated, context(input));
    return {
      ok: true,
      data: { schedule: saved, summary: summarize_schedule(saved) },
    };
  } catch (error) {
    return schedule_error(error, `Failed to ${status} schedule.`);
  }
}

async function run_due_schedule(input: {
  schedule: LocalSchedule;
  now: Date;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
  collect_candidates?: SchedulerCollectProvider;
}): Promise<ScheduleTickItem> {
  const summary =
    input.schedule.type === 'candidate.collect'
      ? await run_collect_schedule(input)
      : await run_auto_advance_schedule(input);
  const updated = record_schedule_run({
    schedule: input.schedule,
    now: input.now,
    summary,
  });
  await save_schedule(updated, context(input));
  return {
    schedule_id: input.schedule.schedule_id,
    status: summary.status,
    message: summary.message,
    created_task_ids: summary.created_task_ids,
  };
}

async function run_collect_schedule(input: {
  schedule: LocalSchedule;
  now: Date;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
  collect_candidates?: SchedulerCollectProvider;
}): Promise<ScheduleRunSummary> {
  const policy = input.schedule.policy;
  if (!('provider' in policy)) {
    return failed_summary(input.now, 'invalid candidate collection policy');
  }
  const result = await collect_candidates_workflow({
    storage_config: input.storage_config,
    cwd: input.cwd,
    now: input.now,
    provider: policy.provider,
    collect:
      input.collect_candidates === undefined
        ? undefined
        : () => input.collect_candidates!(policy.provider),
  });
  if (!result.ok) {
    return failed_summary(input.now, result.error.message);
  }
  return {
    ran_at: input.now.toISOString(),
    status: 'succeeded',
    message: `collected ${result.data.candidates.length} candidates`,
    created_task_ids: [],
    details: { results: result.data.results },
  };
}

async function run_auto_advance_schedule(input: {
  schedule: LocalSchedule;
  now: Date;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
}): Promise<ScheduleRunSummary> {
  const policy = input.schedule.policy;
  if (!('allowed_task_types' in policy)) {
    return failed_summary(input.now, 'invalid auto advancement policy');
  }
  const payloads = await plan_auto_advance_payloads({
    storage_config: input.storage_config,
    cwd: input.cwd,
    allowed_task_types: policy.allowed_task_types,
  });
  const created_task_ids: string[] = [];
  let duplicates = 0;
  for (const payload of payloads) {
    const existing = await find_active_task_by_payload({
      storage_config: input.storage_config,
      cwd: input.cwd,
      payload,
    });
    if (existing !== null) {
      duplicates += 1;
      continue;
    }
    const enqueue = await enqueue_task_workflow({
      storage_config: input.storage_config,
      cwd: input.cwd,
      now: input.now,
      payload,
    });
    if (!enqueue.ok) {
      return failed_summary(input.now, enqueue.error.message);
    }
    created_task_ids.push(enqueue.data.task.task_id);
  }
  return {
    ran_at: input.now.toISOString(),
    status: 'succeeded',
    message: `enqueued ${created_task_ids.length} tasks`,
    created_task_ids,
    details: { planned: payloads.length, duplicates },
  };
}

async function plan_auto_advance_payloads(input: {
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
  allowed_task_types: AutoAdvanceTaskType[];
}): Promise<TaskPayload[]> {
  const allowed = new Set(input.allowed_task_types);
  const payloads: TaskPayload[] = [];
  const repo_context = context(input);
  const sources = await list_sources({}, repo_context);
  for (const source of sources) {
    if (allowed.has('source.process') && source.status === 'ingested') {
      payloads.push({
        type: 'source.process',
        input: { source_id: source.id },
      });
    }
    if (
      allowed.has('source.understand') &&
      source.status === 'processed' &&
      source.processing_artifacts.clean_text !== undefined &&
      source.processing_artifacts.segments !== undefined &&
      source.processing_artifacts.metadata !== undefined
    ) {
      payloads.push({
        type: 'source.understand',
        input: { source_id: source.id },
      });
    }
  }
  const notes = await list_notes({}, repo_context);
  for (const note of notes) {
    if (allowed.has('note.render')) {
      payloads.push({ type: 'note.render', input: { note_id: note.id } });
    }
    if (allowed.has('note.lint') && note.status === 'draft') {
      payloads.push({ type: 'note.lint', input: { note_id: note.id } });
    }
    if (allowed.has('note.index') && note.status === 'approved') {
      const has_index = await index_exists(note.id, repo_context);
      if (!has_index) {
        payloads.push({ type: 'note.index', input: { note_id: note.id } });
      }
    }
  }
  return payloads;
}

async function index_exists(
  note_id: string,
  repo_context: { config?: Partial<StorageConfig>; cwd?: string },
): Promise<boolean> {
  try {
    await get_index_entry(note_id, repo_context);
    return true;
  } catch (error) {
    if (error instanceof StorageError && error.code === 'NOT_FOUND') {
      return false;
    }
    throw error;
  }
}

function build_policy(input: ScheduleCreateInput): LocalSchedule['policy'] {
  if (input.type === 'candidate.collect') {
    if (input.provider === undefined) {
      throw new Error('candidate collection schedule requires provider');
    }
    return { provider: input.provider };
  }
  return {
    mode: 'enqueue',
    allowed_task_types:
      input.allowed_task_types ?? default_auto_advance_task_types,
  };
}

function schedule_slug(input: ScheduleCreateInput): string {
  if (input.type === 'candidate.collect') {
    return input.provider ?? 'candidate-collect';
  }
  return 'safe-defaults';
}

function skipped(schedule: LocalSchedule, message: string): ScheduleTickItem {
  return {
    schedule_id: schedule.schedule_id,
    status: 'skipped',
    message,
    created_task_ids: [],
  };
}

function failed_summary(now: Date, message: string): ScheduleRunSummary {
  return {
    ran_at: now.toISOString(),
    status: 'failed',
    message,
    created_task_ids: [],
  };
}

function context(input: {
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
}): { config?: Partial<StorageConfig>; cwd?: string } {
  return { config: input.storage_config, cwd: input.cwd };
}

function schedule_error<T>(
  error: unknown,
  fallback_message: string,
): WorkflowResult<T> {
  if (error instanceof StorageError && error.code === 'NOT_FOUND') {
    return {
      ok: false,
      error: { code: 'NOT_FOUND', message: error.message, cause: error },
    };
  }
  return {
    ok: false,
    error: {
      code:
        error instanceof StorageError
          ? 'STORAGE_FAILED'
          : error instanceof z.ZodError
            ? 'VALIDATION_FAILED'
            : 'UNKNOWN',
      message: error instanceof Error ? error.message : fallback_message,
      cause: error,
    },
  };
}
