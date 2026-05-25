import { describe, expect, it } from 'vitest';
import { process_markdown } from '../../src/processing/markdown-processor.js';

describe('markdown processor', () => {
  it('normalizes whitespace and segments content without headings', () => {
    const result = process_markdown({
      raw_markdown: 'First paragraph.   \n\n\nSecond paragraph.\n',
      source_title: 'Fallback Title',
      processed_at: '2026-05-14T00:00:00.000Z',
    });

    expect(result.clean_text).toBe('First paragraph.\n\nSecond paragraph.\n');
    expect(result.segments).toEqual([
      {
        id: 'seg_0001',
        order: 1,
        heading_path: [],
        text: 'First paragraph.',
        locator: {
          ref: 'processed/segments.json#seg_0001',
          source_kind: 'markdown',
          position: 1,
          heading_path: [],
        },
      },
      {
        id: 'seg_0002',
        order: 2,
        heading_path: [],
        text: 'Second paragraph.',
        locator: {
          ref: 'processed/segments.json#seg_0002',
          source_kind: 'markdown',
          position: 2,
          heading_path: [],
        },
      },
    ]);
    expect(result.metadata.title).toBe('Fallback Title');
  });

  it('keeps heading paths and stable segment order', () => {
    const result = process_markdown({
      raw_markdown: '# Main\n\nIntro.\n\n## Detail\n\nDetail body.\n',
      source_title: 'Fallback',
      processed_at: '2026-05-14T00:00:00.000Z',
    });

    expect(result.segments).toEqual([
      {
        id: 'seg_0001',
        order: 1,
        heading_path: ['Main'],
        text: 'Intro.',
        locator: {
          ref: 'processed/segments.json#seg_0001',
          source_kind: 'markdown',
          position: 1,
          heading_path: ['Main'],
        },
      },
      {
        id: 'seg_0002',
        order: 2,
        heading_path: ['Main', 'Detail'],
        text: 'Detail body.',
        locator: {
          ref: 'processed/segments.json#seg_0002',
          source_kind: 'markdown',
          position: 2,
          heading_path: ['Main', 'Detail'],
        },
      },
    ]);
    expect(result.metadata.headings).toEqual([
      { level: 1, title: 'Main' },
      { level: 2, title: 'Detail' },
    ]);
  });

  it('preserves markdown links in clean text and extracts link metadata', () => {
    const result = process_markdown({
      raw_markdown: '# Links\n\nRead [docs](https://example.com/docs).\n',
      source_title: 'Fallback',
      processed_at: '2026-05-14T00:00:00.000Z',
    });

    expect(result.clean_text).toContain('[docs](https://example.com/docs)');
    expect(result.metadata.links).toEqual([
      { text: 'docs', url: 'https://example.com/docs' },
    ]);
    expect(result.metadata.segment_count).toBe(1);
  });

  it('removes frontmatter from processed text', () => {
    const result = process_markdown({
      raw_markdown: '---\ntitle: Hidden\n---\n\n# Visible\n\nBody.\n',
      source_title: 'Fallback',
      processed_at: '2026-05-14T00:00:00.000Z',
    });

    expect(result.clean_text).toBe('# Visible\n\nBody.\n');
    expect(result.metadata.title).toBe('Visible');
  });
});
