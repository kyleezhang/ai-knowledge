import { describe, expect, it } from 'vitest';
import {
  extract_html_title,
  process_url_html,
} from '../../src/processing/url-processor.js';

describe('url processor', () => {
  it('extracts readable text, headings, lists, links, and source metadata', () => {
    const result = process_url_html({
      raw_html: `
        <html>
          <head><title>Example &amp; Docs</title><style>.x{}</style></head>
          <body>
            <script>ignored()</script>
            <h1>Main Title</h1>
            <p>Read <a href="/docs">docs</a>.</p>
            <ul><li>First item</li><li>Second item</li></ul>
          </body>
        </html>
      `,
      source_title: 'Fallback Title',
      source_url: 'https://example.com/articles/post',
      processed_at: '2026-05-14T01:10:00.000Z',
    });

    expect(result.clean_text).toContain('# Main Title');
    expect(result.clean_text).toContain('[docs](https://example.com/docs)');
    expect(result.clean_text).toContain('- First item');
    expect(result.clean_text).not.toContain('ignored');
    expect(result.metadata).toMatchObject({
      title: 'Example & Docs',
      source_url: 'https://example.com/articles/post',
      processed_at: '2026-05-14T01:10:00.000Z',
    });
    expect(result.metadata.links).toEqual([
      { text: 'docs', url: 'https://example.com/docs' },
    ]);
    expect(result.metadata.segment_count).toBeGreaterThan(0);
    expect(result.segments[0]?.locator).toEqual({
      ref: 'processed/segments.json#seg_0001',
      source_kind: 'url',
      position: 1,
      heading_path: ['Main Title'],
      section: 'main-title',
    });
  });

  it('falls back to source title when HTML title is empty', () => {
    const result = process_url_html({
      raw_html:
        '<html><head><title>   </title></head><body><p>Body.</p></body></html>',
      source_title: 'Fallback Title',
      source_url: 'https://example.com/article',
      processed_at: '2026-05-14T01:10:00.000Z',
    });

    expect(result.metadata.title).toBe('Fallback Title');
    expect(result.clean_text).toBe('# Fallback Title\n\nBody.\n');
  });

  it('uses the title as minimal text when body has no readable content', () => {
    const result = process_url_html({
      raw_html:
        '<html><head><title>Only Title</title></head><body><script>x</script></body></html>',
      source_title: 'Fallback Title',
      source_url: 'https://example.com/article',
      processed_at: '2026-05-14T01:10:00.000Z',
    });

    expect(result.clean_text).toBe('# Only Title\n');
    expect(result.segments).toEqual([]);
  });

  it('decodes common HTML entities in titles', () => {
    expect(extract_html_title('<title>A &lt; B &amp; C</title>')).toBe(
      'A < B & C',
    );
  });
});
