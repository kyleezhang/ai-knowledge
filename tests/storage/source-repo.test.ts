import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { create_source, list_sources } from '../../src/storage/source-repo.js';
import {
  create_temp_dir,
  create_test_source,
  write_markdown_fixture,
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
