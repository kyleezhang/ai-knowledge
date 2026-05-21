import {
  build_processed_document,
  type DocumentProcessingResult,
} from './document-processor.js';

export type UrlProcessingResult = DocumentProcessingResult;

export function process_url_html(input: {
  raw_html: string;
  source_title: string;
  source_url: string;
  processed_at: string;
}): UrlProcessingResult {
  const title = extract_html_title(input.raw_html) ?? input.source_title;
  const markdown_like_text = html_to_markdown_like_text({
    raw_html: input.raw_html,
    source_url: input.source_url,
    title,
  });

  return build_processed_document({
    raw_text: markdown_like_text,
    source_title: input.source_title,
    processed_at: input.processed_at,
    metadata_overrides: {
      title,
      source_url: input.source_url,
    },
  });
}

export function extract_html_title(raw_html: string): string | null {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/iu.exec(raw_html);
  if (match === null) {
    return null;
  }

  const title = decode_html_entities(strip_tags(match[1])).trim();
  return title.length === 0 ? null : title;
}

function html_to_markdown_like_text(input: {
  raw_html: string;
  source_url: string;
  title: string;
}): string {
  let html = input.raw_html
    .replace(/<!--([\s\S]*?)-->/gu, ' ')
    .replace(/<script\b[\s\S]*?<\/script>/giu, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/giu, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/giu, ' ')
    .replace(/<svg\b[\s\S]*?<\/svg>/giu, ' ');

  const body_match = /<body[^>]*>([\s\S]*?)<\/body>/iu.exec(html);
  if (body_match !== null) {
    html = body_match[1];
  }

  html = replace_anchor_tags(html, input.source_url);
  html = replace_heading_tags(html);
  html = html.replace(/<li[^>]*>([\s\S]*?)<\/li>/giu, (_, inner: string) => {
    const text = decode_html_entities(strip_tags(inner)).trim();
    return text.length === 0 ? '\n' : `\n- ${text}\n`;
  });
  html = html
    .replace(/<br\s*\/?>/giu, '\n')
    .replace(
      /<\/(p|div|section|article|main|header|footer|aside|ul|ol|table|tr|blockquote)>/giu,
      '\n\n',
    )
    .replace(
      /<(p|div|section|article|main|header|footer|aside|ul|ol|table|tr|blockquote)[^>]*>/giu,
      '\n',
    )
    .replace(/<hr\s*\/?>/giu, '\n\n');

  const text = decode_html_entities(strip_tags(html)).trim();
  if (text.length === 0) {
    return `# ${input.title}`;
  }

  if (/^#{1,6}\s+/mu.test(text)) {
    return text;
  }

  return `# ${input.title}\n\n${text}`;
}

function replace_anchor_tags(html: string, source_url: string): string {
  return html.replace(
    /<a\b[^>]*href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/giu,
    (
      _,
      double_quoted_href,
      single_quoted_href,
      unquoted_href,
      inner: string,
    ) => {
      const href =
        double_quoted_href ?? single_quoted_href ?? unquoted_href ?? null;
      const text = decode_html_entities(strip_tags(inner)).trim();
      if (text.length === 0) {
        return '';
      }

      const resolved_href = resolve_link(href, source_url);
      return resolved_href === null ? text : `[${text}](${resolved_href})`;
    },
  );
}

function replace_heading_tags(html: string): string {
  return html.replace(
    /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/giu,
    (_, level: string, inner: string) => {
      const text = decode_html_entities(strip_tags(inner)).trim();
      if (text.length === 0) {
        return '\n\n';
      }

      return `\n\n${'#'.repeat(Number(level))} ${text}\n\n`;
    },
  );
}

function resolve_link(href: string | null, source_url: string): string | null {
  if (href === null || href.trim().length === 0) {
    return null;
  }

  try {
    return new URL(href, source_url).href;
  } catch {
    return null;
  }
}

function strip_tags(value: string): string {
  return value.replace(/<[^>]+>/gu, ' ');
}

function decode_html_entities(value: string): string {
  return value.replace(
    /&(#x?[0-9a-f]+|[a-z]+);/giu,
    (entity, token: string) => {
      const normalized = token.toLowerCase();
      if (normalized === 'amp') {
        return '&';
      }
      if (normalized === 'lt') {
        return '<';
      }
      if (normalized === 'gt') {
        return '>';
      }
      if (normalized === 'quot') {
        return '"';
      }
      if (normalized === 'apos') {
        return "'";
      }
      if (normalized === 'nbsp') {
        return ' ';
      }
      if (normalized.startsWith('#x')) {
        return String.fromCodePoint(Number.parseInt(normalized.slice(2), 16));
      }
      if (normalized.startsWith('#')) {
        return String.fromCodePoint(Number.parseInt(normalized.slice(1), 10));
      }
      return entity;
    },
  );
}
