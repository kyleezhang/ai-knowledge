import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  read_processed_artifacts,
  read_raw_original_markdown,
  write_processed_artifacts,
} from '../../src/storage/artifact-store.js';
import { create_source, list_sources } from '../../src/storage/source-repo.js';
import {
  create_temp_dir,
  create_test_source,
  write_markdown_fixture,
  write_pdf_fixture,
} from '../source-test-helpers.js';

describe('source repo', () => {
  it('creates Source layout and preserves raw Markdown content', async () => {
    const cwd = await create_temp_dir();
    const raw_file_path = await write_markdown_fixture(
      cwd,
      'source.md',
      '# Original\n\nKeep this exact content.\n',
    );
    const source = create_test_source();

    await create_source({ source, raw_file_path }, { cwd });

    const source_dir = path.join(
      cwd,
      'knowledge',
      'sources',
      '2026',
      '05',
      source.id,
    );
    await expect(
      stat(path.join(source_dir, 'source.json')),
    ).resolves.toBeTruthy();
    await expect(
      stat(path.join(source_dir, 'processed')),
    ).resolves.toBeTruthy();
    await expect(
      readFile(path.join(source_dir, 'discussion.jsonl'), 'utf8'),
    ).resolves.toBe('');
    await expect(
      readFile(path.join(source_dir, 'raw', 'original.md'), 'utf8'),
    ).resolves.toBe('# Original\n\nKeep this exact content.\n');
  });

  it('creates PDF Source layout and preserves raw PDF content', async () => {
    const cwd = await create_temp_dir();
    const raw_file_path = await write_pdf_fixture(cwd, 'source.pdf');
    const source = create_test_source({
      id: 'src_20260514_upload_pdf_test-source',
      ingest_type: 'upload_pdf',
      origin: {
        type: 'user_import',
        candidate_id: null,
        user_input_type: 'pdf',
      },
    });

    await create_source({ source, raw_file_path }, { cwd });

    const source_dir = path.join(
      cwd,
      'knowledge',
      'sources',
      '2026',
      '05',
      source.id,
    );
    await expect(
      readFile(path.join(source_dir, 'raw', 'original.pdf')),
    ).resolves.toEqual(Buffer.from('%PDF-1.4\n% fake pdf fixture\n', 'utf8'));
  });

  it('creates URL Source layout from fetched HTML content', async () => {
    const cwd = await create_temp_dir();
    const source = create_test_source({
      id: 'src_20260514_input_url_example-com-article',
      title: 'example-com-article',
      ingest_type: 'input_url',
      content_type: 'link',
      origin: {
        type: 'user_import',
        candidate_id: null,
        user_input_type: 'url',
      },
      url: 'https://example.com/article',
    });

    await create_source(
      {
        source,
        raw_file_name: 'fetched.html',
        raw_content: '<html><body><h1>Article</h1><p>Body</p></body></html>',
      },
      { cwd },
    );

    const source_dir = path.join(
      cwd,
      'knowledge',
      'sources',
      '2026',
      '05',
      source.id,
    );
    await expect(
      readFile(path.join(source_dir, 'raw', 'fetched.html'), 'utf8'),
    ).resolves.toContain('<h1>Article</h1>');
  });

  it('rejects invalid raw file names when creating a Source', async () => {
    const cwd = await create_temp_dir();
    const source = create_test_source({
      id: 'src_20260514_input_url_example-com-article',
      title: 'example-com-article',
      ingest_type: 'input_url',
      content_type: 'link',
      origin: {
        type: 'user_import',
        candidate_id: null,
        user_input_type: 'url',
      },
      url: 'https://example.com/article',
    });

    await expect(
      create_source(
        {
          source,
          raw_file_name: '../fetched.html',
          raw_content: '<html></html>',
        },
        { cwd },
      ),
    ).rejects.toThrow('Invalid raw file name');
  });

  it('reads raw Markdown and writes processed artifacts', async () => {
    const cwd = await create_temp_dir();
    const raw_file_path = await write_markdown_fixture(
      cwd,
      'source.md',
      '# Original\n\nKeep this exact content.\n',
    );
    const source = create_test_source();

    await create_source({ source, raw_file_path }, { cwd });
    const raw_before = await read_raw_original_markdown(source.id, { cwd });
    const paths = await write_processed_artifacts(
      {
        source,
        clean_text: '# Original\n\nKeep this exact content.\n',
        segments: [
          {
            id: 'seg_0001',
            order: 1,
            heading_path: [],
            text: 'Body',
            locator: {
              ref: 'processed/segments.json#seg_0001',
              source_kind: 'markdown',
              position: 1,
              heading_path: [],
            },
          },
        ],
        metadata: {
          title: 'Original',
          headings: [{ level: 1, title: 'Original' }],
          links: [],
          segment_count: 1,
          processed_at: '2026-05-14T00:00:00.000Z',
        },
      },
      { cwd },
    );
    const raw_after = await read_raw_original_markdown(source.id, { cwd });

    expect(paths).toEqual({
      clean_text: 'processed/clean_text.md',
      segments: 'processed/segments.json',
      metadata: 'processed/metadata.json',
    });
    expect(raw_after).toBe(raw_before);

    const source_dir = path.join(
      cwd,
      'knowledge',
      'sources',
      '2026',
      '05',
      source.id,
    );
    await expect(
      readFile(path.join(source_dir, 'processed', 'clean_text.md'), 'utf8'),
    ).resolves.toBe('# Original\n\nKeep this exact content.\n');
    await expect(
      readFile(path.join(source_dir, 'processed', 'segments.json'), 'utf8'),
    ).resolves.toContain('seg_0001');
    await expect(
      readFile(path.join(source_dir, 'processed', 'metadata.json'), 'utf8'),
    ).resolves.toContain('Original');
  });

  it('reads processed artifacts with schema validation', async () => {
    const cwd = await create_temp_dir();
    const raw_file_path = await write_markdown_fixture(cwd);
    const source = create_test_source({
      status: 'processed',
      processing_artifacts: {
        clean_text: 'processed/clean_text.md',
        segments: 'processed/segments.json',
        metadata: 'processed/metadata.json',
      },
    });

    await create_source({ source, raw_file_path }, { cwd });
    await write_processed_artifacts(
      {
        source,
        clean_text: '# Title\n\nBody.\n',
        segments: [
          {
            id: 'seg_0001',
            order: 1,
            heading_path: ['Title'],
            text: 'Body.',
            locator: {
              ref: 'processed/segments.json#seg_0001',
              source_kind: 'markdown',
              position: 1,
              heading_path: ['Title'],
            },
          },
        ],
        metadata: {
          title: 'Title',
          headings: [{ level: 1, title: 'Title' }],
          links: [],
          segment_count: 1,
          processed_at: '2026-05-14T00:00:00.000Z',
        },
      },
      { cwd },
    );

    await expect(read_processed_artifacts(source, { cwd })).resolves.toEqual({
      clean_text: '# Title\n\nBody.\n',
      segments: [
        {
          id: 'seg_0001',
          order: 1,
          heading_path: ['Title'],
          text: 'Body.',
          locator: {
            ref: 'processed/segments.json#seg_0001',
            source_kind: 'markdown',
            position: 1,
            heading_path: ['Title'],
          },
        },
      ],
      metadata: {
        title: 'Title',
        headings: [{ level: 1, title: 'Title' }],
        links: [],
        segment_count: 1,
        processed_at: '2026-05-14T00:00:00.000Z',
      },
    });
  });

  it('rejects missing or invalid processed artifacts', async () => {
    const cwd = await create_temp_dir();
    const raw_file_path = await write_markdown_fixture(cwd);
    const source = create_test_source({
      status: 'processed',
      processing_artifacts: {
        clean_text: 'processed/clean_text.md',
        segments: 'processed/segments.json',
        metadata: 'processed/metadata.json',
      },
    });

    await create_source({ source, raw_file_path }, { cwd });

    await expect(read_processed_artifacts(source, { cwd })).rejects.toThrow(
      'Failed to read processed artifacts',
    );

    await expect(
      write_processed_artifacts(
        {
          source,
          clean_text: 'Body',
          segments: [{ bad: 'shape' }],
          metadata: {},
        },
        { cwd },
      ),
    ).rejects.toThrow('Failed to write processed artifacts');
  });

  it('rejects path traversal when writing artifacts', async () => {
    const cwd = await create_temp_dir();
    const raw_file_path = await write_markdown_fixture(cwd);
    const source = create_test_source();

    await create_source({ source, raw_file_path }, { cwd });

    await expect(
      write_processed_artifacts(
        {
          source: {
            ...source,
            id: '../bad',
          },
          clean_text: '',
          segments: [],
          metadata: {},
        },
        { cwd },
      ),
    ).rejects.toThrow();
  });

  it('lists Sources by updated_at descending and filters by status', async () => {
    const cwd = await create_temp_dir();
    const raw_file_path = await write_markdown_fixture(cwd);
    const older = create_test_source({
      id: 'src_20260514_upload_markdown_older',
      title: 'Older',
      status: 'ingested',
      updated_at: '2026-05-14T00:00:00.000Z',
    });
    const newer = create_test_source({
      id: 'src_20260515_upload_markdown_newer',
      title: 'Newer',
      status: 'failed',
      updated_at: '2026-05-15T00:00:00.000Z',
      last_error: {
        stage: 'processing',
        message: 'failed',
        occurred_at: '2026-05-15T00:00:00.000Z',
      },
    });

    await create_source({ source: older, raw_file_path }, { cwd });
    await create_source({ source: newer, raw_file_path }, { cwd });

    const all_sources = await list_sources({}, { cwd });
    expect(all_sources.map((source) => source.id)).toEqual([
      newer.id,
      older.id,
    ]);

    const ingested_sources = await list_sources(
      { status: 'ingested' },
      { cwd },
    );
    expect(ingested_sources.map((source) => source.id)).toEqual([older.id]);
  });
});
