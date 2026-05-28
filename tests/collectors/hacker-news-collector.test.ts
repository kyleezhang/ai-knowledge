import { describe, expect, it } from 'vitest';
import {
  collect_hacker_news,
  parse_hacker_news_response,
} from '../../src/collectors/hacker-news-collector.js';

const hacker_news_response = {
  hits: [
    {
      objectID: '123',
      title: 'AI agents in production',
      url: 'https://example.com/ai-agents',
      author: 'hn-user',
      created_at: '2026-05-27T00:00:00.000Z',
      points: 42,
      num_comments: 7,
    },
  ],
};

describe('hacker news collector', () => {
  it('normalizes Hacker News stories into Candidate inputs', () => {
    const candidates = parse_hacker_news_response(hacker_news_response);

    expect(candidates).toEqual([
      expect.objectContaining({
        source_type: 'hacker_news',
        title: 'AI agents in production',
        summary:
          'Hacker News story with 42 points, 7 comments: AI agents in production',
        url: 'https://example.com/ai-agents',
        author: 'hn-user',
        published_at: '2026-05-27T00:00:00.000Z',
        tags: ['hacker-news', 'ai'],
        external_ref: expect.objectContaining({
          platform: 'hacker_news',
          id: '123',
        }),
      }),
    ]);
  });

  it('uses injected fetcher and does not require network access', async () => {
    const result = await collect_hacker_news({
      fetcher: async () => JSON.stringify(hacker_news_response),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidates[0].title).toBe('AI agents in production');
  });

  it('returns structured errors for fetch and parse failures', async () => {
    const fetch_failed = await collect_hacker_news({
      fetcher: async () => {
        throw new Error('offline');
      },
    });
    const parse_failed = await collect_hacker_news({
      fetcher: async () => JSON.stringify({ hits: [] }),
    });

    expect(fetch_failed.ok).toBe(false);
    if (!fetch_failed.ok) expect(fetch_failed.error.code).toBe('FETCH_FAILED');
    expect(parse_failed.ok).toBe(false);
    if (!parse_failed.ok) expect(parse_failed.error.code).toBe('PARSE_FAILED');
  });
});
