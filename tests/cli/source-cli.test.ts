import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { create_program, type CliIo } from '../../src/cli/index.js';
import type { DraftUnderstandingCandidate } from '../../src/agents/schemas.js';
import type { LlmClient } from '../../src/agents/types.js';
import type { UnderstandAgentInput } from '../../src/agents/understand-agent.js';
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

  it('processes Markdown with human-readable output', async () => {
    const cwd = await create_temp_dir();
    const file_path = await write_markdown_fixture(
      cwd,
      'input.md',
      '# Process CLI\n\nBody.\n',
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
    const process_harness = create_cli_harness(cwd);

    await process_harness.run([
      'source',
      'process',
      ingest_json.data.source_id,
    ]);

    expect(process_harness.stdout.join('\n')).toContain('Source processed.');
    expect(process_harness.stdout.join('\n')).toContain('status: processed');
    expect(process_harness.stdout.join('\n')).toContain(
      'processed/clean_text.md',
    );
    expect(process_harness.stdout.join('\n')).toContain(
      'ai-knowledge source understand',
    );
  });

  it('generates draft understanding with human-readable output', async () => {
    const cwd = await create_temp_dir();
    const source_id = await ingest_and_process(
      cwd,
      '# Understand CLI\n\nBody.\n',
    );
    const harness = create_cli_harness(cwd, {
      understand: async ({ agent_input }) => ({
        summary: `Summary for ${agent_input.source_title}`,
        key_points: ['Point'],
        uncertainties: ['Unclear'],
        discussion_starters: ['Question?'],
      }),
    });

    await harness.run(['source', 'understand', source_id]);

    expect(harness.stdout.join('\n')).toContain('Draft understanding ready.');
    expect(harness.stdout.join('\n')).toContain('status: understanding_ready');
    expect(harness.stdout.join('\n')).toContain(
      'draft_understanding_summary: Summary for Understand CLI',
    );
    expect(harness.stdout.join('\n')).toContain('ai-knowledge source discuss');
    expect(harness.stdout.join('\n')).not.toContain('key_points:');
  });

  it('shows full draft understanding with --show', async () => {
    const cwd = await create_temp_dir();
    const source_id = await ingest_and_process(cwd, '# Show Draft\n\nBody.\n');
    const harness = create_cli_harness(cwd, {
      understand: async () => ({
        summary: 'Summary',
        key_points: ['Point'],
        uncertainties: ['Unclear'],
        discussion_starters: ['Question?'],
      }),
    });

    await harness.run(['source', 'understand', source_id, '--show']);

    expect(harness.stdout.join('\n')).toContain('draft_understanding:');
    expect(harness.stdout.join('\n')).toContain('key_points: ["Point"]');
  });

  it('supports JSON output for source understand', async () => {
    const cwd = await create_temp_dir();
    const source_id = await ingest_and_process(
      cwd,
      '# JSON Understand\n\nBody.\n',
    );
    const harness = create_cli_harness(cwd, {
      understand: async () => ({
        summary: 'Summary',
        key_points: ['Point'],
        uncertainties: ['Unclear'],
        discussion_starters: ['Question?'],
      }),
    });

    await harness.run(['source', 'understand', source_id, '--json']);

    expect(JSON.parse(harness.stdout[0])).toMatchObject({
      ok: true,
      data: {
        source: { status: 'understanding_ready' },
        draft_understanding: {
          summary: 'Summary',
          key_points: ['Point'],
        },
      },
      next_actions: [{ command: `ai-knowledge source discuss ${source_id}` }],
    });
  });

  it('prints a structured error for understand status mismatch', async () => {
    const cwd = await create_temp_dir();
    const file_path = await write_markdown_fixture(cwd);
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
    const harness = create_cli_harness(cwd, {
      understand: async () => ({
        summary: 'Summary',
        key_points: [],
        uncertainties: [],
        discussion_starters: [],
      }),
    });

    await harness.run(['source', 'understand', ingest_json.data.source_id]);

    expect(harness.exit_code).toBe(1);
    expect(harness.stderr.join('\n')).toContain('code: INVALID_STATE');
  });

  it('supports JSON output for source process', async () => {
    const cwd = await create_temp_dir();
    const file_path = await write_markdown_fixture(
      cwd,
      'input.md',
      '# JSON Process\n',
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
    const process_harness = create_cli_harness(cwd);

    await process_harness.run([
      'source',
      'process',
      ingest_json.data.source_id,
      '--json',
    ]);

    expect(JSON.parse(process_harness.stdout[0])).toMatchObject({
      ok: true,
      data: {
        source: {
          status: 'processed',
          processing_artifacts: {
            clean_text: 'processed/clean_text.md',
          },
        },
      },
      next_actions: [
        {
          command: `ai-knowledge source understand ${ingest_json.data.source_id}`,
        },
      ],
    });
  });

  it('prints a structured error for process status mismatch', async () => {
    const cwd = await create_temp_dir();
    const file_path = await write_markdown_fixture(cwd);
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
    const first_process = create_cli_harness(cwd);
    await first_process.run(['source', 'process', ingest_json.data.source_id]);
    const second_process = create_cli_harness(cwd);

    await second_process.run(['source', 'process', ingest_json.data.source_id]);

    expect(second_process.exit_code).toBe(1);
    expect(second_process.stderr.join('\n')).toContain('code: INVALID_STATE');
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

async function ingest_and_process(
  cwd: string,
  content: string,
): Promise<string> {
  const file_path = await write_markdown_fixture(cwd, 'input.md', content);
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
  const process_harness = create_cli_harness(cwd);
  await process_harness.run(['source', 'process', ingest_json.data.source_id]);
  return ingest_json.data.source_id;
}

function create_cli_harness(
  cwd: string,
  options: {
    understand?: (input: {
      llm_client: LlmClient;
      agent_input: UnderstandAgentInput;
    }) => Promise<DraftUnderstandingCandidate>;
  } = {},
): {
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
      await create_program({
        io,
        cwd,
        understand: options.understand,
      }).parseAsync(['node', 'ai-knowledge', ...args]);
    },
  };
}
