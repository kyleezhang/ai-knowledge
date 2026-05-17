export type MarkdownSegment = {
  id: string;
  order: number;
  heading_path: string[];
  text: string;
};

export type MarkdownHeading = {
  level: number;
  title: string;
};

export type MarkdownLink = {
  text: string;
  url: string;
};

export type MarkdownMetadata = {
  title: string;
  headings: MarkdownHeading[];
  links: MarkdownLink[];
  segment_count: number;
  processed_at: string;
};

export type MarkdownProcessingResult = {
  clean_text: string;
  segments: MarkdownSegment[];
  metadata: MarkdownMetadata;
};

export function process_markdown(input: {
  raw_markdown: string;
  source_title: string;
  processed_at: string;
}): MarkdownProcessingResult {
  const without_frontmatter = input.raw_markdown.replace(
    /^---\s*\n[\s\S]*?\n---\s*\n?/u,
    '',
  );
  const clean_text = normalize_markdown(without_frontmatter);
  const headings = extract_headings(clean_text);
  const links = extract_links(clean_text);
  const segments = segment_markdown(clean_text);

  return {
    clean_text,
    segments,
    metadata: {
      title:
        headings.find((heading) => heading.level === 1)?.title ??
        input.source_title,
      headings,
      links,
      segment_count: segments.length,
      processed_at: input.processed_at,
    },
  };
}

function normalize_markdown(raw: string): string {
  return `${raw
    .replace(/\r\n?/gu, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/gu, ''))
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim()}\n`;
}

function extract_headings(markdown: string): MarkdownHeading[] {
  return markdown
    .split('\n')
    .map((line) => /^(#{1,6})\s+(.+?)\s*#*\s*$/u.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => ({
      level: match[1].length,
      title: match[2].trim(),
    }));
}

function extract_links(markdown: string): MarkdownLink[] {
  const links: MarkdownLink[] = [];
  const pattern = /\[([^\]]+)\]\(([^)\s]+)\)/gu;
  for (const match of markdown.matchAll(pattern)) {
    links.push({ text: match[1], url: match[2] });
  }
  return links;
}

function segment_markdown(markdown: string): MarkdownSegment[] {
  const segments: MarkdownSegment[] = [];
  const heading_stack: string[] = [];
  let buffer: string[] = [];

  for (const line of markdown.split('\n')) {
    const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/u.exec(line);
    if (heading !== null) {
      flush_segment(segments, heading_stack, buffer);
      buffer = [];
      const level = heading[1].length;
      heading_stack.length = level - 1;
      heading_stack[level - 1] = heading[2].trim();
      continue;
    }

    if (line.trim() === '') {
      flush_segment(segments, heading_stack, buffer);
      buffer = [];
      continue;
    }

    buffer.push(line);
  }

  flush_segment(segments, heading_stack, buffer);
  return segments;
}

function flush_segment(
  segments: MarkdownSegment[],
  heading_path: string[],
  buffer: string[],
): void {
  const text = buffer.join('\n').trim();
  if (text.length === 0) {
    return;
  }

  const order = segments.length + 1;
  segments.push({
    id: `seg_${String(order).padStart(4, '0')}`,
    order,
    heading_path: heading_path.filter(Boolean),
    text,
  });
}
