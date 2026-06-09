import type { LocalSchedule } from '../domain/local-schedule.js';

export type ScheduleSummary = {
  schedule_id: string;
  type: LocalSchedule['type'];
  status: LocalSchedule['status'];
  next_run_at: string;
  last_run_at: string | null;
  updated_at: string;
  last_run_status: string | null;
};

export function summarize_schedule(schedule: LocalSchedule): ScheduleSummary {
  return {
    schedule_id: schedule.schedule_id,
    type: schedule.type,
    status: schedule.status,
    next_run_at: schedule.next_run_at,
    last_run_at: schedule.last_run_at,
    updated_at: schedule.updated_at,
    last_run_status: schedule.last_run_summary?.status ?? null,
  };
}
