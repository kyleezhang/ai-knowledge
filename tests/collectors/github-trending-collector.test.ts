import { describe, expect, it } from 'vitest';
import {
  collect_github_trending,
  parse_github_trending_html,
} from '../../src/collectors/github-trending-collector.js';

const github_trending_html = `
<article>
  <h2><a href="/owner/repo"> owner / repo </a></h2>
  <p>A useful AI coding agent.</p>
  <span itemprop="programmingLanguage">TypeScript</span>
</article>
`;

describe('github trending collector', () => {
  it('normalizes GitHub Trending repositories into Candidate inputs', () => {
    const candidates = parse_github_trending_html(github_trending_html);

    expect(candidates).toEqual([
      expect.objectContaining({
        source_type: 'github_trending',
        title: 'owner/repo',
        summary: 'A useful AI coding agent.',
        url: 'https://github.com/owner/repo',
        author: 'owner',
        published_at: null,
        tags: ['github-trending', 'typescript'],
        external_ref: expect.objectContaining({
          platform: 'github',
          id: 'owner/repo',
        }),
      }),
    ]);
  });

  it('uses injected fetcher and does not require network access', async () => {
    const result = await collect_github_trending({
      fetcher: async () => github_trending_html,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidates[0].title).toBe('owner/repo');
  });

  it('returns structured errors for fetch and parse failures', async () => {
    const fetch_failed = await collect_github_trending({
      fetcher: async () => {
        throw new Error('offline');
      },
    });
    const parse_failed = await collect_github_trending({
      fetcher: async () => '<html>No repositories</html>',
    });

    expect(fetch_failed.ok).toBe(false);
    if (!fetch_failed.ok) expect(fetch_failed.error.code).toBe('FETCH_FAILED');
    expect(parse_failed.ok).toBe(false);
    if (!parse_failed.ok) expect(parse_failed.error.code).toBe('PARSE_FAILED');
  });
});
