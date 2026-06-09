import { readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { create_test_candidate } from '../candidate-test-helpers.js';
import { create_test_note } from '../note-test-helpers.js';
import { create_temp_dir, create_test_source } from '../source-test-helpers.js';
import { render_note_markdown } from '../../src/notes/render-markdown.js';
import { create_candidate } from '../../src/storage/candidate-repo.js';
import { create_note } from '../../src/storage/note-repo.js';
import { get_schedule } from '../../src/storage/schedule-repo.js';
import { create_source } from '../../src/storage/source-repo.js';
import { list_tasks } from '../../src/storage/task-repo.js';
import {
  create_schedule_workflow,
  disable_schedule_workflow,
  list_schedules_workflow,
  scheduler_tick_workflow,
  show_schedule_workflow,
} from '../../src/workflows/schedule-workflows.js';
import { enqueue_task_workflow } from '../../src/workflows/task-workflows.js';

function collected_candidate() {
  return {
    source_type: 'github_trending' as const,
    title: 'Scheduled AI Agent Candidate',
    summary:
      'A new AI agent research toolkit with practical tradeoff examples and implementation details.',
    url: 'https://github.com/owner/scheduled-repo',
    author: 'owner',
    published_at: null,
    tags: ['github-trending'],
    external_ref: {
      platform: 'github',
      id: 'owner/scheduled-repo',
      url: 'https://github.com/owner/scheduled-repo',
      extra: {},
    },
  };
}

describe('schedule workflows', () => {
  it('creates lists shows and disables schedules', async () => {
    const cwd = await create_temp_dir();
    const create = await create_schedule_workflow({
      cwd,
      now: new Date('2026-06-09T00:00:00.000Z'),
      type: 'candidate.collect',
      provider: 'github-trending',
      rule: { kind: 'interval_minutes', interval_minutes: 60 },
    });
    if (!create.ok) throw new Error(create.error.message);

    const list = await list_schedules_workflow({ cwd });
    const show = await show_schedule_workflow({
      cwd,
      schedule_id: create.data.schedule.schedule_id,
    });
    const disabled = await disable_schedule_workflow({
      cwd,
      schedule_id: create.data.schedule.schedule_id,
      now: new Date('2026-06-09T00:30:00.000Z'),
    });

    expect(create.data.schedule).toMatchObject({
      schedule_id: 'sch_20260609_candidate-collect_github-trending',
      status: 'enabled',
      next_run_at: '2026-06-09T01:00:00.000Z',
    });
    expect(list.ok && list.data.schedules).toHaveLength(1);
    expect(show.ok && show.data.schedule.schedule_id).toBe(
      create.data.schedule.schedule_id,
    );
    expect(disabled.ok && disabled.data.schedule.status).toBe('disabled');
  });

  it('runs due schedules and skips not due or disabled schedules', async () => {
    const cwd = await create_temp_dir();
    const due = await create_schedule_workflow({
      cwd,
      now: new Date('2026-06-09T00:00:00.000Z'),
      type: 'candidate.collect',
      provider: 'github-trending',
      rule: { kind: 'interval_minutes', interval_minutes: 60 },
    });
    if (!due.ok) throw new Error(due.error.message);
    const not_due = await create_schedule_workflow({
      cwd,
      now: new Date('2026-06-09T00:10:00.000Z'),
      type: 'auto.advance',
      rule: { kind: 'interval_minutes', interval_minutes: 120 },
      allowed_task_types: ['source.process'],
    });
    if (!not_due.ok) throw new Error(not_due.error.message);
    await disable_schedule_workflow({
      cwd,
      schedule_id: not_due.data.schedule.schedule_id,
      now: new Date('2026-06-09T00:20:00.000Z'),
    });

    const tick = await scheduler_tick_workflow({
      cwd,
      now: new Date('2026-06-09T01:00:00.000Z'),
      collect_candidates: async () => ({
        ok: true,
        candidates: [collected_candidate()],
      }),
    });

    expect(tick.ok).toBe(true);
    if (!tick.ok) return;
    expect(tick.data.summary.results).toEqual([
      expect.objectContaining({
        status: 'skipped',
        message: 'schedule disabled',
      }),
      expect.objectContaining({ status: 'succeeded', created_task_ids: [] }),
    ]);
    await expect(
      get_schedule(due.data.schedule.schedule_id, { cwd }),
    ).resolves.toMatchObject({
      last_run_at: '2026-06-09T01:00:00.000Z',
      next_run_at: '2026-06-09T02:00:00.000Z',
    });
  });

  it('scheduled collection creates Candidates only', async () => {
    const cwd = await create_temp_dir();
    const schedule = await create_schedule_workflow({
      cwd,
      now: new Date('2026-06-09T00:00:00.000Z'),
      type: 'candidate.collect',
      provider: 'github-trending',
      rule: { kind: 'interval_minutes', interval_minutes: 60 },
    });
    if (!schedule.ok) throw new Error(schedule.error.message);

    const tick = await scheduler_tick_workflow({
      cwd,
      now: new Date('2026-06-09T01:00:00.000Z'),
      collect_candidates: async () => ({
        ok: true,
        candidates: [collected_candidate()],
      }),
    });

    expect(tick.ok).toBe(true);
    await expect(readdir(`${cwd}/knowledge/candidates`)).resolves.toEqual([
      '2026',
    ]);
    await expect(readdir(`${cwd}/knowledge/sources`)).rejects.toThrow();
    await expect(readdir(`${cwd}/knowledge/notes`)).rejects.toThrow();
    await expect(readdir(`${cwd}/knowledge/index`)).rejects.toThrow();
  });

  it('records collection failures in schedule summary', async () => {
    const cwd = await create_temp_dir();
    const schedule = await create_schedule_workflow({
      cwd,
      now: new Date('2026-06-09T00:00:00.000Z'),
      type: 'candidate.collect',
      provider: 'github-trending',
      rule: { kind: 'interval_minutes', interval_minutes: 60 },
    });
    if (!schedule.ok) throw new Error(schedule.error.message);

    const tick = await scheduler_tick_workflow({
      cwd,
      now: new Date('2026-06-09T01:00:00.000Z'),
      collect_candidates: async () => ({
        ok: false,
        error: new Error('collector failed') as never,
      }),
    });

    expect(tick.ok).toBe(true);
    if (!tick.ok) return;
    expect(tick.data.summary.results).toEqual([
      expect.objectContaining({
        status: 'failed',
        message: 'collector failed',
      }),
    ]);
    await expect(
      get_schedule(schedule.data.schedule.schedule_id, { cwd }),
    ).resolves.toMatchObject({
      last_run_summary: expect.objectContaining({ status: 'failed' }),
    });
  });

  it('auto advancement enqueues safe tasks and skips duplicates', async () => {
    const cwd = await create_temp_dir();
    const source = create_test_source({
      id: 'src_20260609_upload_markdown_ready-to-process',
      title: 'Ready to Process',
    });
    await create_source({ source, raw_content: '# Ready\n' }, { cwd });
    const existing = await enqueue_task_workflow({
      cwd,
      now: new Date('2026-06-09T00:10:00.000Z'),
      payload: { type: 'source.process', input: { source_id: source.id } },
    });
    if (!existing.ok) throw new Error(existing.error.message);
    const schedule = await create_schedule_workflow({
      cwd,
      now: new Date('2026-06-09T00:00:00.000Z'),
      type: 'auto.advance',
      rule: { kind: 'interval_minutes', interval_minutes: 60 },
      allowed_task_types: ['source.process'],
    });
    if (!schedule.ok) throw new Error(schedule.error.message);

    const tick = await scheduler_tick_workflow({
      cwd,
      now: new Date('2026-06-09T01:00:00.000Z'),
    });

    expect(tick.ok).toBe(true);
    if (!tick.ok) return;
    expect(tick.data.summary.results).toEqual([
      expect.objectContaining({
        status: 'succeeded',
        message: 'enqueued 0 tasks',
        created_task_ids: [],
      }),
    ]);
    await expect(list_tasks({ cwd })).resolves.toHaveLength(1);
  });

  it('auto advancement stops at human confirmation gates', async () => {
    const cwd = await create_temp_dir();
    await create_candidate(create_test_candidate(), { cwd });
    await create_source(
      {
        source: create_test_source({
          id: 'src_20260609_upload_markdown_approved-for-note',
          status: 'approved_for_note',
          processing_artifacts: {
            clean_text: 'processed/clean_text.md',
            segments: 'processed/segments.json',
            metadata: 'processed/metadata.json',
          },
          draft_understanding: {
            summary: 'summary',
            key_points: ['point'],
            uncertainties: [],
            discussion_starters: [],
            generated_at: '2026-06-09T00:00:00.000Z',
          },
          discussion_summary: {
            discussion_status: 'closed',
            summary_version: 1,
            confirmed_points: ['confirmed'],
            open_questions: [],
            unresolved_issues: [],
            next_prompts: [],
            ready_for_approval: true,
            last_updated_at: '2026-06-09T00:00:00.000Z',
          },
        }),
        raw_content: '# Approved\n',
      },
      { cwd },
    );
    const draft = create_test_note({
      quality_checks: {
        status: 'passed',
        template_complete: true,
        source_links_present: true,
        empty_sections: [],
        last_checked_at: '2026-06-09T00:00:00.000Z',
      },
    });
    await create_note(
      { note: draft, markdown: render_note_markdown(draft) },
      { cwd },
    );
    const schedule = await create_schedule_workflow({
      cwd,
      now: new Date('2026-06-09T00:00:00.000Z'),
      type: 'auto.advance',
      rule: { kind: 'interval_minutes', interval_minutes: 60 },
      allowed_task_types: ['source.process', 'note.index'],
    });
    if (!schedule.ok) throw new Error(schedule.error.message);

    const tick = await scheduler_tick_workflow({
      cwd,
      now: new Date('2026-06-09T01:00:00.000Z'),
    });

    expect(tick.ok).toBe(true);
    if (!tick.ok) return;
    expect(tick.data.summary.results[0].created_task_ids).toEqual([]);
    await expect(list_tasks({ cwd })).resolves.toEqual([]);
  });
});
