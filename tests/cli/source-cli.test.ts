import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { create_program, type CliIo } from '../../src/cli/index.js';
import {
  create_temp_dir,
  write_markdown_fixture,
} from '../source-test-helpers.js';

describe('source CLI', () => {
  it('ingests Markdown with human-readable output', async () => {
    const cwd = await create_temp_dir();
    const file_path = await write_markdown_fixture(
      cwd,
      'input.md',
      '# CLI Source\n\nBody.\n',
    );
    const harness = create_cli_harness(cwd);

    await harness.run(['source', 'ingest', 'markdown', file_path]);

    expect(harness.stdout.join('\n')).toContain('Source ingested.');
    expect(harness.stdout.join('\n')).toContain('title: CLI Source');
    expect(harness.stdout.join('\n')).toContain('status: ingested');
    expect(harness.stdout.join('\n')).toContain('ai-knowledge source process');
    expect(harness.stdout.join('\n')).not.toContain('Body.');
  });

  it('supports JSON output for ingest, list, and show', async () => {
    const cwd = await create_temp_dir();
    const file_path = await write_markdown_fixture(
      cwd,
      'input.md',
      '# JSON Source\n\nBody.\n',
    );
    const ingest_harness = create_cli_harness(cwd);

    await ingest_harness.run([
      'source',
      'ingest',
      'markdown',
      file_path,
      '--json',
    ]);
    const ingest_json = JSON.parse(ingest_harness.stdout[0]) as {
      ok: true;
      data: { source_id: string };
    };

    const list_harness = create_cli_harness(cwd);
    await list_harness.run(['source', 'list', '--json']);

    const show_harness = create_cli_harness(cwd);
    await show_harness.run([
      'source',
      'show',
      ingest_json.data.source_id,
      '--json',
    ]);

    expect(JSON.parse(list_harness.stdout[0])).toMatchObject({
      ok: true,
      data: { sources: [{ title: 'JSON Source', status: 'ingested' }] },
    });
    expect(JSON.parse(show_harness.stdout[0])).toMatchObject({
      ok: true,
      data: { source: { title: 'JSON Source', status: 'ingested' } },
    });
  });

  it('prints a structured error for missing Source', async () => {
    const cwd = await create_temp_dir();
    const harness = create_cli_harness(cwd);

    await harness.run([
      'source',
      'show',
      'src_20260514_upload_markdown_missing',
    ]);

    expect(harness.exit_code).toBe(1);
    expect(harness.stderr.join('\n')).toContain('code: NOT_FOUND');
  });

  it('prints a structured error for invalid input', async () => {
    const cwd = await create_temp_dir();
    const file_path = path.join(cwd, 'input.txt');
    await writeFile(file_path, 'not markdown\n', 'utf8');
    const harness = create_cli_harness(cwd);

    await harness.run(['source', 'ingest', 'markdown', file_path]);

    expect(harness.exit_code).toBe(1);
    expect(harness.stderr.join('\n')).toContain('code: INVALID_INPUT');
  });
});

function create_cli_harness(cwd: string): {
  stdout: string[];
  stderr: string[];
  exit_code: number | undefined;
  run: (args: string[]) => Promise<void>;
} {
  const stdout: string[] = [];
  const stderr: string[] = [];
  let exit_code: number | undefined;
  const io: CliIo = {
    stdout: (message) => stdout.push(message),
    stderr: (message) => stderr.push(message),
    set_exit_code: (code) => {
      exit_code = code;
    },
  };

  return {
    stdout,
    stderr,
    get exit_code() {
      return exit_code;
    },
    run: async (args) => {
      await create_program({ io, cwd }).parseAsync([
        'node',
        'ai-knowledge',
        ...args,
      ]);
    },
  };
}
