import { writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  append_discussion_message,
  read_discussion_messages,
} from '../../src/storage/discussion-log.js';
import { source_discussion_path } from '../../src/storage/paths.js';
import {
  create_temp_dir,
  create_test_source,
  write_markdown_fixture,
} from '../source-test-helpers.js';
import { create_source } from '../../src/storage/source-repo.js';

describe('discussion log', () => {
  it('reads an empty discussion log as an empty array', async () => {
    const cwd = await create_source_fixture();

    await expect(
      read_discussion_messages('src_20260514_upload_markdown_test-source', {
        cwd,
      }),
    ).resolves.toEqual([]);
  });

  it('appends and reads discussion messages in order', async () => {
    const cwd = await create_source_fixture();
    const source_id = 'src_20260514_upload_markdown_test-source';

    await append_discussion_message(
      source_id,
      {
        role: 'user',
        content: 'Hello',
        created_at: '2026-05-14T00:00:00.000Z',
      },
      { cwd },
    );
    await append_discussion_message(
      source_id,
      {
        role: 'assistant',
        content: 'Hi',
        created_at: '2026-05-14T00:01:00.000Z',
      },
      { cwd },
    );

    await expect(read_discussion_messages(source_id, { cwd })).resolves.toEqual(
      [
        {
          role: 'user',
          content: 'Hello',
          created_at: '2026-05-14T00:00:00.000Z',
        },
        {
          role: 'assistant',
          content: 'Hi',
          created_at: '2026-05-14T00:01:00.000Z',
        },
      ],
    );
  });

  it('rejects invalid JSONL content', async () => {
    const cwd = await create_source_fixture();
    const source_id = 'src_20260514_upload_markdown_test-source';
    await writeFile(source_discussion_path(source_id, { cwd }), '{bad json}\n');

    await expect(read_discussion_messages(source_id, { cwd })).rejects.toThrow(
      'Failed to parse discussion messages',
    );
  });
});

async function create_source_fixture(): Promise<string> {
  const cwd = await create_temp_dir();
  const raw_file_path = await write_markdown_fixture(cwd);
  await create_source({ source: create_test_source(), raw_file_path }, { cwd });
  return cwd;
}
