import { PDFParse } from 'pdf-parse';
import {
  build_processed_document,
  normalize_document_text,
  type DocumentProcessingResult,
} from './document-processor.js';

export type PdfProcessingResult = DocumentProcessingResult;

export async function process_pdf(input: {
  raw_pdf: Uint8Array;
  source_title: string;
  processed_at: string;
}): Promise<PdfProcessingResult> {
  const parser = new PDFParse({ data: input.raw_pdf });

  try {
    const [info_result, text_result] = await Promise.all([
      parser.getInfo({ parsePageInfo: true }),
      parser.getText({ parseHyperlinks: true }),
    ]);

    const page_sections = text_result.pages
      .map((page) => {
        const page_text = normalize_document_text(page.text);
        if (page_text.length === 0) {
          return null;
        }

        return `## Page ${page.num}\n\n${page_text.trim()}`;
      })
      .filter((page): page is string => page !== null)
      .join('\n\n');

    return build_processed_document({
      raw_text: page_sections.length > 0 ? page_sections : text_result.text,
      source_title: input.source_title,
      processed_at: input.processed_at,
      metadata_overrides: {
        title: extract_pdf_title(info_result.info),
        page_count: info_result.total,
      },
    });
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

function extract_pdf_title(info: unknown): string | undefined {
  if (
    typeof info === 'object' &&
    info !== null &&
    'Title' in info &&
    typeof info.Title === 'string'
  ) {
    const title = info.Title.trim();
    return title.length === 0 ? undefined : title;
  }

  return undefined;
}
