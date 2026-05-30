import {
  build_processed_document,
  type DocumentProcessingResult,
} from './document-processor.js';

export type MarkdownProcessingResult = DocumentProcessingResult;

export function process_markdown(input: {
  raw_markdown: string;
  source_title: string;
  processed_at: string;
  source_kind?: 'markdown' | 'feishu_doc';
}): MarkdownProcessingResult {
  const without_frontmatter = input.raw_markdown.replace(
    /^---\s*\n[\s\S]*?\n---\s*\n?/u,
    '',
  );

  return build_processed_document({
    raw_text: without_frontmatter,
    source_title: input.source_title,
    processed_at: input.processed_at,
    segment_locator_overrides: { source_kind: input.source_kind },
  });
}
