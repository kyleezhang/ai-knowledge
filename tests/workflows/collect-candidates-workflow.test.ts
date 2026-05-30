import { readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { CollectorError } from '../../src/collectors/types.js';
import {
  create_candidate,
  get_candidate,
} from '../../src/storage/candidate-repo.js';
import { create_test_candidate } from '../candidate-test-helpers.js';
import {
  collect_candidates_workflow,
  type CandidateCollectorProvider,
} from '../../src/workflows/collect-candidates-workflow.js';
import { create_temp_dir } from '../source-test-helpers.js';

describe('collect candidates workflow', () => {
  it('collects GitHub Trending Candidates into Candidate storage', async () => {
    const cwd = await create_temp_dir();

    const result = await collect_candidates_workflow({
      cwd,
      provider: 'github-trending',
      now: new Date('2026-05-27T00:00:00.000Z'),
      collect: async () => ({
        ok: true,
        candidates: [collected_candidate('github-trending')],
      }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.candidates).toHaveLength(1);
    expect(result.data.candidates[0]).toMatchObject({
      id: 'cand_20260527_github_trending_github-ai-agent-candidate',
      status: 'recommended',
    });
    expect(result.data.candidates[0].score.total).toBeGreaterThanOrEqual(8);
    expect(result.data.results).toEqual([
      { status: 'created', candidate: result.data.candidates[0] },
    ]);
    await expect(
      get_candidate(result.data.candidates[0].id, { cwd }),
    ).resolves.toMatchObject({
      status: 'recommended',
      converted_source_id: null,
    });
  });

  it('collects Hacker News Candidates into Candidate storage', async () => {
    const cwd = await create_temp_dir();

    const result = await collect_candidates_workflow({
      cwd,
      provider: 'hacker-news',
      now: new Date('2026-05-27T00:00:00.000Z'),
      collect: async () => ({
        ok: true,
        candidates: [collected_candidate('hacker-news')],
      }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.candidates[0]).toMatchObject({
      id: 'cand_20260527_hacker_news_hacker-news-ai-agent-candidate',
      source_type: 'hacker_news',
    });
  });

  it('returns duplicate result without creating a new Candidate', async () => {
    const cwd = await create_temp_dir();
    const existing = create_test_candidate({
      id: 'cand_20260526_github_trending_existing',
      title: 'GitHub Candidate',
      url: 'https://github.com/owner/repo',
      external_ref: {
        platform: 'github',
        id: 'owner/repo',
        url: 'https://github.com/owner/repo',
        extra: {},
      },
    });
    await create_candidate(existing, { cwd });

    const result = await collect_candidates_workflow({
      cwd,
      provider: 'github-trending',
      now: new Date('2026-05-27T00:00:00.000Z'),
      collect: async () => ({
        ok: true,
        candidates: [collected_candidate('github-trending')],
      }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.candidates).toEqual([]);
    expect(result.data.results).toEqual([
      {
        status: 'duplicate',
        title: 'GitHub AI Agent Candidate',
        reason: 'canonical_url',
        existing_candidate_id: existing.id,
      },
    ]);
  });

  it('returns structured error and creates no Candidate on collector failure', async () => {
    const cwd = await create_temp_dir();

    const result = await collect_candidates_workflow({
      cwd,
      provider: 'github-trending',
      collect: async () => ({
        ok: false,
        error: new CollectorError({
          code: 'FETCH_FAILED',
          message: 'fetch failed',
        }),
      }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PROCESSING_FAILED');
      expect(result.error.details).toEqual({
        code: 'FETCH_FAILED',
        details: undefined,
      });
    }
    await expect(readdir(`${cwd}/knowledge/candidates`)).rejects.toThrow();
  });

  it('does not create Source, Note, or Index files', async () => {
    const cwd = await create_temp_dir();
    await collect_candidates_workflow({
      cwd,
      provider: 'github-trending',
      now: new Date('2026-05-27T00:00:00.000Z'),
      collect: async () => ({
        ok: true,
        candidates: [collected_candidate('github-trending')],
      }),
    });

    await expect(readdir(`${cwd}/knowledge/sources`)).rejects.toThrow();
    await expect(readdir(`${cwd}/knowledge/notes`)).rejects.toThrow();
    await expect(readdir(`${cwd}/knowledge/index`)).rejects.toThrow();
  });
});

function collected_candidate(provider: CandidateCollectorProvider) {
  const is_github = provider === 'github-trending';
  return {
    source_type: is_github
      ? ('github_trending' as const)
      : ('hacker_news' as const),
    title: is_github
      ? 'GitHub AI Agent Candidate'
      : 'Hacker News AI Agent Candidate',
    summary:
      'A new AI agent research toolkit with practical tradeoff examples and implementation details.',
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
  };
}
