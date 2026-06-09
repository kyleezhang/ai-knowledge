import { z } from 'zod';
import { format_local_date_for_id } from './time.js';

export const ScheduleStatusSchema = z.enum(['enabled', 'disabled']);

export const ScheduleTypeSchema = z.enum(['candidate.collect', 'auto.advance']);

export const ScheduleRuleSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('interval_minutes'),
    interval_minutes: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal('daily_time'),
    daily_time: z.string().regex(/^\d{2}:\d{2}$/),
  }),
]);

export const AutoAdvanceTaskTypeSchema = z.enum([
  'source.process',
  'source.understand',
  'note.render',
  'note.lint',
  'note.index',
]);

export const CandidateCollectProviderSchema = z.enum([
  'github-trending',
  'hacker-news',
]);

export const CandidateCollectSchedulePolicySchema = z.object({
  provider: CandidateCollectProviderSchema,
});

export const AutoAdvanceSchedulePolicySchema = z.object({
  mode: z.literal('enqueue'),
  allowed_task_types: z.array(AutoAdvanceTaskTypeSchema),
});

export const SchedulePolicySchema = z.union([
  CandidateCollectSchedulePolicySchema,
  AutoAdvanceSchedulePolicySchema,
]);

export const ScheduleRunSummarySchema = z.object({
  ran_at: z.string(),
  status: z.enum(['succeeded', 'failed', 'skipped']),
  message: z.string(),
  created_task_ids: z.array(z.string()).default([]),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const LocalScheduleSchema = z.object({
  schedule_id: z.string(),
  type: ScheduleTypeSchema,
  status: ScheduleStatusSchema,
  rule: ScheduleRuleSchema,
  policy: SchedulePolicySchema,
  created_at: z.string(),
  updated_at: z.string(),
  last_run_at: z.string().nullable(),
  next_run_at: z.string(),
  last_run_summary: ScheduleRunSummarySchema.nullable(),
});

export type ScheduleStatus = z.infer<typeof ScheduleStatusSchema>;
export type ScheduleType = z.infer<typeof ScheduleTypeSchema>;
export type ScheduleRule = z.infer<typeof ScheduleRuleSchema>;
export type AutoAdvanceTaskType = z.infer<typeof AutoAdvanceTaskTypeSchema>;
export type CandidateCollectSchedulePolicy = z.infer<
  typeof CandidateCollectSchedulePolicySchema
>;
export type AutoAdvanceSchedulePolicy = z.infer<
  typeof AutoAdvanceSchedulePolicySchema
>;
export type SchedulePolicy = z.infer<typeof SchedulePolicySchema>;
export type ScheduleRunSummary = z.infer<typeof ScheduleRunSummarySchema>;
export type LocalSchedule = z.infer<typeof LocalScheduleSchema>;

const unsafe_key_pattern =
  /api[_-]?key|cookie|token|secret|credential|password|raw[_-]?content/i;

export const default_auto_advance_task_types: AutoAdvanceTaskType[] = [
  'source.process',
  'source.understand',
  'note.render',
  'note.lint',
  'note.index',
];

export function parse_local_schedule(value: unknown): LocalSchedule {
  assert_safe_schedule_payload(value);
  const schedule = LocalScheduleSchema.parse(value);
  validate_local_schedule(schedule);
  return schedule;
}

export function validate_local_schedule(schedule: LocalSchedule): void {
  if (!schedule.schedule_id.startsWith('sch_')) {
    throw new Error('local schedule id must start with sch_');
  }
  if (schedule.created_at.trim().length === 0) {
    throw new Error('local schedule must have created_at');
  }
  if (schedule.updated_at.trim().length === 0) {
    throw new Error('local schedule must have updated_at');
  }
  if (schedule.next_run_at.trim().length === 0) {
    throw new Error('local schedule must have next_run_at');
  }
  if (schedule.type === 'candidate.collect') {
    CandidateCollectSchedulePolicySchema.parse(schedule.policy);
  }
  if (schedule.type === 'auto.advance') {
    const policy = AutoAdvanceSchedulePolicySchema.parse(schedule.policy);
    if (policy.allowed_task_types.length === 0) {
      throw new Error(
        'auto advance schedule must allow at least one task type',
      );
    }
  }
  assert_safe_schedule_payload(schedule.policy);
}

export function create_schedule_id(input: {
  date: Date;
  type: ScheduleType;
  slug: string;
  timezone?: string;
  suffix?: string;
}): string {
  const date_part = format_local_date_for_id(input.date, input.timezone);
  const safe_slug = input.slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const type_part = input.type.replace('.', '-');
  const base = `sch_${date_part}_${type_part}_${safe_slug}`;
  return input.suffix === undefined ? base : `${base}_${input.suffix}`;
}

export function calculate_next_run_at(input: {
  rule: ScheduleRule;
  from: Date;
}): string {
  if (input.rule.kind === 'interval_minutes') {
    return new Date(
      input.from.getTime() + input.rule.interval_minutes * 60_000,
    ).toISOString();
  }

  const [hour, minute] = input.rule.daily_time.split(':').map(Number);
  if (hour > 23 || minute > 59) {
    throw new Error('daily_time must be a valid HH:mm time');
  }
  const next = new Date(input.from);
  next.setUTCHours(hour, minute, 0, 0);
  if (next.getTime() <= input.from.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.toISOString();
}

export function schedule_is_due(input: {
  schedule: LocalSchedule;
  now: string;
}): boolean {
  return (
    input.schedule.status === 'enabled' &&
    Date.parse(input.schedule.next_run_at) <= Date.parse(input.now)
  );
}

export function enable_schedule(
  schedule: LocalSchedule,
  now: string,
): LocalSchedule {
  return parse_local_schedule({
    ...schedule,
    status: 'enabled',
    updated_at: now,
  });
}

export function disable_schedule(
  schedule: LocalSchedule,
  now: string,
): LocalSchedule {
  return parse_local_schedule({
    ...schedule,
    status: 'disabled',
    updated_at: now,
  });
}

export function record_schedule_run(input: {
  schedule: LocalSchedule;
  now: Date;
  summary: ScheduleRunSummary;
}): LocalSchedule {
  const timestamp = input.now.toISOString();
  return parse_local_schedule({
    ...input.schedule,
    last_run_at: timestamp,
    next_run_at: calculate_next_run_at({
      rule: input.schedule.rule,
      from: input.now,
    }),
    last_run_summary: input.summary,
    updated_at: timestamp,
  });
}

export function assert_safe_schedule_payload(value: unknown): void {
  visit_safe_payload(value, []);
}

function visit_safe_payload(value: unknown, path: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      visit_safe_payload(item, [...path, String(index)]),
    );
    return;
  }
  if (typeof value !== 'object' || value === null) {
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (unsafe_key_pattern.test(key)) {
      throw new Error(
        `unsafe schedule payload field: ${[...path, key].join('.')}`,
      );
    }
    visit_safe_payload(nested, [...path, key]);
  }
}
