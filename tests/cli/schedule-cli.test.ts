import { describe, expect, it } from 'vitest';
import { create_program, type CliIo } from '../../src/cli/index.js';
import type { CollectorResult } from '../../src/collectors/types.js';
import type { CandidateCollectorProvider } from '../../src/workflows/collect-candidates-workflow.js';
import { create_temp_dir } from '../source-test-helpers.js';

function harness(
  cwd: string,
  collect_candidates?: (
    provider: CandidateCollectorProvider,
  ) => Promise<CollectorResult>,
) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  let exit_code: number | undefined;
  const io: CliIo = {
    stdout: (message) => stdout.push(message),
    stderr: (message) => stderr.push(message),
    set_exit_code: (code) => {
      exit_code = code;
    },
  };
  return {
    stdout,
    stderr,
    get exit_code() {
      return exit_code;
    },
    run: async (args: string[]) => {
      await create_program({ cwd, io, collect_candidates }).parseAsync([
        'node',
        'ai-knowledge',
        ...args,
      ]);
    },
  };
}

describe('schedule CLI', () => {
  it('creates lists shows and disables collection schedules with JSON output', async () => {
    const cwd = await create_temp_dir();
    const create = harness(cwd);
    await create.run([
      'schedule',
      'create',
      'collection',
      'github-trending',
      '--interval-minutes',
      '60',
      '--json',
    ]);
    const schedule_id = (
      JSON.parse(create.stdout[0]) as {
        ok: true;
        data: { schedule: { schedule_id: string } };
      }
    ).data.schedule.schedule_id;

    const list = harness(cwd);
    await list.run(['schedule', 'list', '--json']);
    const show = harness(cwd);
    await show.run(['schedule', 'show', schedule_id, '--json']);
    const disable = harness(cwd);
    await disable.run(['schedule', 'disable', schedule_id, '--json']);

    expect(JSON.parse(list.stdout[0])).toMatchObject({
      ok: true,
      data: { schedules: [expect.objectContaining({ schedule_id })] },
    });
    expect(JSON.parse(show.stdout[0])).toMatchObject({
      ok: true,
      data: { schedule: { schedule_id } },
    });
    expect(JSON.parse(disable.stdout[0])).toMatchObject({
      ok: true,
      data: { schedule: { status: 'disabled' } },
    });
  });

  it('creates auto advance schedule with safe human output', async () => {
    const cwd = await create_temp_dir();
    const cli = harness(cwd);

    await cli.run([
      'schedule',
      'create',
      'auto-advance',
      '--daily-time',
      '08:30',
    ]);

    expect(cli.exit_code).toBeUndefined();
    expect(cli.stdout.join('\n')).toContain('Schedule created.');
    expect(cli.stdout.join('\n')).toContain('will not select Candidates');
  });

  it('runs scheduler tick with injected collection and JSON output', async () => {
    const cwd = await create_temp_dir();
    const create = harness(cwd);
    await create.run([
      'schedule',
      'create',
      'collection',
      'github-trending',
      '--interval-minutes',
      '0',
    ]);
    expect(create.exit_code).toBe(1);

    const valid = harness(cwd);
    await valid.run([
      'schedule',
      'create',
      'collection',
      'github-trending',
      '--interval-minutes',
      '1',
    ]);
    const tick = harness(cwd, async () => ({
      ok: true,
      candidates: [
        {
          source_type: 'github_trending',
          title: 'Scheduled CLI Candidate',
          summary:
            'A new AI agent research toolkit with practical tradeoff examples and implementation details.',
          url: 'https://github.com/owner/cli-scheduled',
          author: 'owner',
          published_at: null,
          tags: ['github-trending'],
          external_ref: {
            platform: 'github',
            id: 'owner/cli-scheduled',
            url: 'https://github.com/owner/cli-scheduled',
            extra: {},
          },
        },
      ],
    }));
    await tick.run(['schedule', 'tick', '--json']);

    expect(JSON.parse(tick.stdout[0])).toMatchObject({
      ok: true,
      data: {
        summary: {
          results: [expect.objectContaining({ status: 'skipped' })],
        },
      },
    });
  });

  it('rejects ambiguous schedule rule options', async () => {
    const cwd = await create_temp_dir();
    const cli = harness(cwd);

    await cli.run(['schedule', 'create', 'collection', 'github-trending']);

    expect(cli.exit_code).toBe(1);
    expect(cli.stderr.join('\n')).toContain(
      'Provide exactly one of --interval-minutes or --daily-time.',
    );
  });
});
