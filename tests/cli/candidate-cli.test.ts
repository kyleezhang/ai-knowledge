import { describe, expect, it } from 'vitest';
import { create_program, type CliIo } from '../../src/cli/index.js';
import type { CollectorResult } from '../../src/collectors/types.js';
import type { CandidateCollectorProvider } from '../../src/workflows/collect-candidates-workflow.js';
import { create_candidate } from '../../src/storage/candidate-repo.js';
import { create_test_candidate } from '../candidate-test-helpers.js';
import { create_temp_dir } from '../source-test-helpers.js';

describe('candidate CLI', () => {
  it('collects GitHub Trending and Hacker News Candidates', async () => {
    const cwd = await create_temp_dir();
    const text = create_cli_harness(cwd, collect_fixture);
    await text.run(['candidate', 'collect', 'github-trending']);
    const json = create_cli_harness(cwd, collect_fixture);
    await json.run(['candidate', 'collect', 'hacker-news', '--json']);

    expect(text.stdout.join('\n')).toContain('GitHub Candidate');
    expect(JSON.parse(json.stdout[0])).toMatchObject({
      ok: true,
      data: {
        provider: 'hacker-news',
        candidates: [
          { source_type: 'hacker_news', title: 'Hacker News Candidate' },
        ],
      },
    });
  });

  it('returns structured error for collector failure', async () => {
    const cwd = await create_temp_dir();
    const harness = create_cli_harness(cwd, async () => ({
      ok: false,
      error: new Error('collector failed') as never,
    }));

    await harness.run(['candidate', 'collect', 'github-trending']);

    expect(harness.exit_code).toBe(1);
    expect(harness.stderr.join('\n')).toContain('collector failed');
  });

  it('lists Candidates with text and JSON output', async () => {
    const cwd = await create_temp_dir();
    const candidate = create_test_candidate();
    await create_candidate(candidate, { cwd });

    const text = create_cli_harness(cwd);
    await text.run(['candidate', 'list']);
    const json = create_cli_harness(cwd);
    await json.run(['candidate', 'list', '--json']);

    expect(text.stdout.join('\n')).toContain(candidate.id);
    expect(text.stdout.join('\n')).toContain('source_type: github_trending');
    expect(JSON.parse(json.stdout[0])).toMatchObject({
      ok: true,
      data: { candidates: [{ id: candidate.id }] },
    });
  });

  it('filters Candidate list by status and rejects invalid status', async () => {
    const cwd = await create_temp_dir();
    const recommended = create_test_candidate({
      id: 'cand_20260514_github_trending_recommended',
      status: 'recommended',
    });
    const dismissed = create_test_candidate({
      id: 'cand_20260514_github_trending_dismissed',
      status: 'dismissed',
    });
    await create_candidate(recommended, { cwd });
    await create_candidate(dismissed, { cwd });

    const filtered = create_cli_harness(cwd);
    await filtered.run([
      'candidate',
      'list',
      '--status',
      'recommended',
      '--json',
    ]);
    const invalid = create_cli_harness(cwd);
    await invalid.run(['candidate', 'list', '--status', 'approved']);

    expect(JSON.parse(filtered.stdout[0])).toMatchObject({
      ok: true,
      data: { candidates: [{ id: recommended.id }] },
    });
    expect(JSON.parse(filtered.stdout[0]).data.candidates).toHaveLength(1);
    expect(invalid.exit_code).toBe(1);
    expect(invalid.stderr.join('\n')).toContain('code: INVALID_INPUT');
  });

  it('shows Candidate with text and JSON output', async () => {
    const cwd = await create_temp_dir();
    const candidate = create_test_candidate();
    await create_candidate(candidate, { cwd });

    const text = create_cli_harness(cwd);
    await text.run(['candidate', 'show', candidate.id]);
    const json = create_cli_harness(cwd);
    await json.run(['candidate', 'show', candidate.id, '--json']);

    expect(text.stdout.join('\n')).toContain(`id: ${candidate.id}`);
    expect(text.stdout.join('\n')).toContain(`title: ${candidate.title}`);
    expect(JSON.parse(json.stdout[0])).toMatchObject({
      ok: true,
      data: { candidate: { id: candidate.id } },
    });
  });

  it('returns structured error for missing Candidate and exposes no write commands', async () => {
    const cwd = await create_temp_dir();
    const missing = create_cli_harness(cwd);
    await missing.run([
      'candidate',
      'show',
      'cand_20260514_github_trending_missing',
    ]);
    const select = create_cli_harness(cwd);
    await expect(
      select.run([
        'candidate',
        'select',
        'cand_20260514_github_trending_missing',
      ]),
    ).rejects.toThrow();

    expect(missing.exit_code).toBe(1);
    expect(missing.stderr.join('\n')).toContain('code: NOT_FOUND');
  });
});

function create_cli_harness(
  cwd: string,
  collect_candidates?: (
    provider: CandidateCollectorProvider,
  ) => Promise<CollectorResult>,
): {
  stdout: string[];
  stderr: string[];
  exit_code: number | undefined;
  run: (args: string[]) => Promise<void>;
} {
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
    run: async (args) => {
      await create_program({ io, cwd, collect_candidates }).parseAsync([
        'node',
        'ai-knowledge',
        ...args,
      ]);
    },
  };
}

async function collect_fixture(
  provider: CandidateCollectorProvider,
): Promise<CollectorResult> {
  const is_github = provider === 'github-trending';
  return {
    ok: true,
    candidates: [
      {
        source_type: is_github ? 'github_trending' : 'hacker_news',
        title: is_github ? 'GitHub Candidate' : 'Hacker News Candidate',
        summary: 'Collected candidate summary.',
        url: is_github
          ? 'https://github.com/owner/repo'
          : 'https://example.com/hn-story',
        author: is_github ? 'owner' : 'hn-user',
        published_at: null,
        tags: [is_github ? 'github-trending' : 'hacker-news'],
        external_ref: {
          platform: is_github ? 'github' : 'hacker_news',
          id: is_github ? 'owner/repo' : '123',
          url: is_github
            ? 'https://github.com/owner/repo'
            : 'https://news.ycombinator.com/item?id=123',
          extra: {},
        },
      },
    ],
  };
}
