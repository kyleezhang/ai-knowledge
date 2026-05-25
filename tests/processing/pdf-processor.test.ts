import { beforeEach, describe, expect, it, vi } from 'vitest';

const pdf_parser = vi.hoisted(() => ({
  getInfo: vi.fn(),
  getText: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock('pdf-parse', () => ({
  PDFParse: vi.fn().mockImplementation(function PDFParseMock(this: {
    getInfo: typeof pdf_parser.getInfo;
    getText: typeof pdf_parser.getText;
    destroy: typeof pdf_parser.destroy;
  }) {
    this.getInfo = pdf_parser.getInfo;
    this.getText = pdf_parser.getText;
    this.destroy = pdf_parser.destroy;
  }),
}));

import { process_pdf } from '../../src/processing/pdf-processor.js';

describe('pdf processor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pdf_parser.getInfo.mockResolvedValue({
      info: { Title: 'PDF Title' },
      total: 2,
    });
    pdf_parser.getText.mockResolvedValue({
      text: 'Page one.\nPage two.',
      pages: [
        { num: 1, text: 'Page one.   \n\n' },
        { num: 2, text: 'Page two.' },
      ],
    });
    pdf_parser.destroy.mockResolvedValue(undefined);
  });

  it('extracts page-aware text, segments, and metadata', async () => {
    const result = await process_pdf({
      raw_pdf: new Uint8Array([1, 2, 3]),
      source_title: 'Fallback Title',
      processed_at: '2026-05-14T01:00:00.000Z',
    });

    expect(result.clean_text).toBe(
      '## Page 1\n\nPage one.\n\n## Page 2\n\nPage two.\n',
    );
    expect(result.segments).toEqual([
      {
        id: 'seg_0001',
        order: 1,
        heading_path: ['Page 1'],
        text: 'Page one.',
        locator: {
          ref: 'processed/segments.json#seg_0001',
          source_kind: 'pdf',
          position: 1,
          page: 1,
          heading_path: ['Page 1'],
        },
      },
      {
        id: 'seg_0002',
        order: 2,
        heading_path: ['Page 2'],
        text: 'Page two.',
        locator: {
          ref: 'processed/segments.json#seg_0002',
          source_kind: 'pdf',
          position: 2,
          page: 2,
          heading_path: ['Page 2'],
        },
      },
    ]);
    expect(result.metadata).toMatchObject({
      title: 'PDF Title',
      page_count: 2,
      segment_count: 2,
      processed_at: '2026-05-14T01:00:00.000Z',
    });
    expect(result.metadata.headings).toEqual([
      { level: 2, title: 'Page 1' },
      { level: 2, title: 'Page 2' },
    ]);
    expect(pdf_parser.destroy).toHaveBeenCalledTimes(1);
  });

  it('uses source title when PDF metadata title is empty', async () => {
    pdf_parser.getInfo.mockResolvedValue({
      info: { Title: '   ' },
      total: 1,
    });

    const result = await process_pdf({
      raw_pdf: new Uint8Array([1, 2, 3]),
      source_title: 'Fallback Title',
      processed_at: '2026-05-14T01:00:00.000Z',
    });

    expect(result.metadata.title).toBe('Fallback Title');
  });

  it('rejects PDFs with no extractable text', async () => {
    pdf_parser.getText.mockResolvedValue({
      text: '   ',
      pages: [
        { num: 1, text: '   ' },
        { num: 2, text: '\n\n' },
      ],
    });

    await expect(
      process_pdf({
        raw_pdf: new Uint8Array([1, 2, 3]),
        source_title: 'Empty PDF',
        processed_at: '2026-05-14T01:00:00.000Z',
      }),
    ).rejects.toThrow('PDF processing produced no extractable text.');
    expect(pdf_parser.destroy).toHaveBeenCalledTimes(1);
  });

  it('destroys the parser when extraction fails', async () => {
    pdf_parser.getText.mockRejectedValue(new Error('parse failed'));

    await expect(
      process_pdf({
        raw_pdf: new Uint8Array([1, 2, 3]),
        source_title: 'Broken PDF',
        processed_at: '2026-05-14T01:00:00.000Z',
      }),
    ).rejects.toThrow('parse failed');
    expect(pdf_parser.destroy).toHaveBeenCalledTimes(1);
  });
});
