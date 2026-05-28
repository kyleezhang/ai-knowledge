import {
  CollectorError,
  type CollectedCandidateInput,
  type CollectorFetch,
  type CollectorResult,
  fetch_text,
} from './types.js';

const hacker_news_algolia_url =
  'https://hn.algolia.com/api/v1/search_by_date?tags=story&query=AI';

type HackerNewsResponse = {
  hits?: HackerNewsHit[];
};

type HackerNewsHit = {
  objectID?: string;
  title?: string | null;
  story_title?: string | null;
  url?: string | null;
  story_url?: string | null;
  author?: string | null;
  created_at?: string | null;
  points?: number | null;
  num_comments?: number | null;
};

export async function collect_hacker_news(
  input: {
    fetcher?: CollectorFetch;
    url?: string;
  } = {},
): Promise<CollectorResult> {
  const fetcher = input.fetcher ?? fetch_text;
  const url = input.url ?? hacker_news_algolia_url;

  let text: string;
  try {
    text = await fetcher(url);
  } catch (error) {
    return {
      ok: false,
      error: new CollectorError({
        code: 'FETCH_FAILED',
        message: 'Failed to fetch Hacker News stories.',
        cause: error,
      }),
    };
  }

  try {
    const candidates = parse_hacker_news_response(JSON.parse(text));
    if (candidates.length === 0) {
      return {
        ok: false,
        error: new CollectorError({
          code: 'PARSE_FAILED',
          message: 'Hacker News response contained no story entries.',
        }),
      };
    }
    return { ok: true, candidates };
  } catch (error) {
    return {
      ok: false,
      error: new CollectorError({
        code: 'PARSE_FAILED',
        message: 'Failed to parse Hacker News response.',
        cause: error,
      }),
    };
  }
}

export function parse_hacker_news_response(
  response: HackerNewsResponse,
): CollectedCandidateInput[] {
  const hits = Array.isArray(response.hits) ? response.hits : [];
  return hits.flatMap((hit) => {
    const title = hit.title ?? hit.story_title ?? null;
    if (title === null || title.trim().length === 0) {
      return [];
    }

    const id = hit.objectID ?? title;
    const url =
      hit.url ?? hit.story_url ?? `https://news.ycombinator.com/item?id=${id}`;
    const summary_parts = [
      hit.points === null || hit.points === undefined
        ? null
        : `${hit.points} points`,
      hit.num_comments === null || hit.num_comments === undefined
        ? null
        : `${hit.num_comments} comments`,
    ].filter((item): item is string => item !== null);

    return [
      {
        source_type: 'hacker_news',
        title: title.trim(),
        summary:
          summary_parts.length === 0
            ? `Hacker News story: ${title.trim()}`
            : `Hacker News story with ${summary_parts.join(', ')}: ${title.trim()}`,
        url,
        author: hit.author ?? null,
        published_at: hit.created_at ?? null,
        tags: ['hacker-news', 'ai'],
        external_ref: {
          platform: 'hacker_news',
          id,
          url: `https://news.ycombinator.com/item?id=${id}`,
          extra: {
            points: hit.points ?? null,
            num_comments: hit.num_comments ?? null,
          },
        },
      },
    ];
  });
}
