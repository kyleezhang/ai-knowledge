import {
  CollectorError,
  type CollectedCandidateInput,
  type CollectorFetch,
  type CollectorResult,
  fetch_text,
} from './types.js';

const github_trending_url = 'https://github.com/trending';

export async function collect_github_trending(
  input: {
    fetcher?: CollectorFetch;
    url?: string;
  } = {},
): Promise<CollectorResult> {
  const fetcher = input.fetcher ?? fetch_text;
  const url = input.url ?? github_trending_url;

  let html: string;
  try {
    html = await fetcher(url);
  } catch (error) {
    return {
      ok: false,
      error: new CollectorError({
        code: 'FETCH_FAILED',
        message: 'Failed to fetch GitHub Trending.',
        cause: error,
      }),
    };
  }

  try {
    const candidates = parse_github_trending_html(html);
    if (candidates.length === 0) {
      return {
        ok: false,
        error: new CollectorError({
          code: 'PARSE_FAILED',
          message: 'GitHub Trending response contained no repository entries.',
        }),
      };
    }
    return { ok: true, candidates };
  } catch (error) {
    return {
      ok: false,
      error: new CollectorError({
        code: 'PARSE_FAILED',
        message: 'Failed to parse GitHub Trending response.',
        cause: error,
      }),
    };
  }
}

export function parse_github_trending_html(
  html: string,
): CollectedCandidateInput[] {
  const articles = [...html.matchAll(/<article\b[\s\S]*?<\/article>/giu)].map(
    (match) => match[0],
  );

  return articles.flatMap((article) => {
    const repo_path = extract_repo_path(article);
    if (repo_path === null) {
      return [];
    }

    const description = extract_description(article);
    const language = extract_language(article);
    const tags = ['github-trending'];
    if (language !== null) {
      tags.push(language.toLowerCase());
    }

    return [
      {
        source_type: 'github_trending',
        title: repo_path,
        summary: description ?? `GitHub Trending repository ${repo_path}`,
        url: `https://github.com/${repo_path}`,
        author: repo_path.split('/')[0] ?? null,
        published_at: null,
        tags,
        external_ref: {
          platform: 'github',
          id: repo_path,
          url: `https://github.com/${repo_path}`,
          extra: {
            language,
          },
        },
      },
    ];
  });
}

function extract_repo_path(article: string): string | null {
  const match =
    /<h2[\s\S]*?<a\b[^>]*href="\/?([^"#?]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/iu.exec(
      article,
    );
  if (match === null) {
    return null;
  }

  const href_path = match[1]
    .split('/')
    .map((part) => decode_html_entities(strip_tags(part)).trim())
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .join('/');
  if (href_path.includes('/')) {
    return href_path;
  }

  const text_path = decode_html_entities(strip_tags(match[2]))
    .replace(/\s+/gu, '')
    .replace(/^\//u, '')
    .replace(/\/$/u, '');
  return text_path.includes('/') ? text_path : null;
}

function extract_description(article: string): string | null {
  const match = /<p\b[^>]*>([\s\S]*?)<\/p>/iu.exec(article);
  if (match === null) {
    return null;
  }
  const description = decode_html_entities(strip_tags(match[1])).trim();
  return description.length === 0 ? null : description;
}

function extract_language(article: string): string | null {
  const match = /itemprop="programmingLanguage"[^>]*>([\s\S]*?)<\/span>/iu.exec(
    article,
  );
  if (match === null) {
    return null;
  }
  const language = decode_html_entities(strip_tags(match[1])).trim();
  return language.length === 0 ? null : language;
}

function strip_tags(value: string): string {
  return value.replace(/<[^>]+>/gu, ' ');
}

function decode_html_entities(value: string): string {
  return value
    .replace(/&amp;/giu, '&')
    .replace(/&lt;/giu, '<')
    .replace(/&gt;/giu, '>')
    .replace(/&quot;/giu, '"')
    .replace(/&#39;/giu, "'");
}
