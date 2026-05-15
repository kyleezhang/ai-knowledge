import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { KNOWLEDGE_SUBDIRS, init_storage } from '../../src/storage/init.js';

async function create_temp_dir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'ai-knowledge-'));
}

describe('init_storage', () => {
  it('creates the required knowledge directory layout', async () => {
    const cwd = await create_temp_dir();

    const result = await init_storage({ cwd });

    expect(result.knowledge_dir).toBe(path.join(cwd, 'knowledge'));
    expect(result.created_dirs).toEqual([
      path.join(cwd, 'knowledge'),
      ...KNOWLEDGE_SUBDIRS.map((subdir) => path.join(cwd, 'knowledge', subdir)),
    ]);
  });

  it('is idempotent and does not overwrite existing files', async () => {
    const cwd = await create_temp_dir();
    await init_storage({ cwd });

    const existing_file = path.join(
      cwd,
      'knowledge',
      'sources',
      'existing.txt',
    );
    await writeFile(existing_file, 'keep me\n', 'utf8');

    await init_storage({ cwd });

    await expect(readFile(existing_file, 'utf8')).resolves.toBe('keep me\n');
  });
});
