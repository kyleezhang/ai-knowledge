import { describe, expect, it } from 'vitest';
import { create_program, type CliIo } from '../../src/cli/index.js';
import {
  create_temp_dir,
  write_markdown_fixture,
} from '../source-test-helpers.js';

function harness(cwd: string) {
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
    run: async (args: string[]) => {
      await create_program({ cwd, io }).parseAsync([
        'node',
        'ai-knowledge',
        ...args,
      ]);
    },
  };
}

describe('task CLI', () => {
  it('enqueues lists shows and runs task with JSON output', async () => {
    const cwd = await create_temp_dir();
    const fixture = await write_markdown_fixture(
      cwd,
      'task-cli.md',
      `# Task CLI

Body.
`,
    );
    const ingest = harness(cwd);
    await ingest.run(['source', 'ingest', 'markdown', fixture, '--json']);
    const source_id = (
      JSON.parse(ingest.stdout[0]) as { ok: true; data: { source_id: string } }
    ).data.source_id;

    const enqueue = harness(cwd);
    await enqueue.run([
      'task',
      'enqueue',
      'source.process',
      source_id,
      '--json',
    ]);
    const task_id = (
      JSON.parse(enqueue.stdout[0]) as {
        ok: true;
        data: { task: { task_id: string } };
      }
    ).data.task.task_id;

    const list = harness(cwd);
    await list.run(['task', 'list', '--json']);
    expect(JSON.parse(list.stdout[0])).toMatchObject({
      ok: true,
      data: { tasks: [expect.objectContaining({ task_id })] },
    });

    const show = harness(cwd);
    await show.run(['task', 'show', task_id, '--json']);
    expect(JSON.parse(show.stdout[0])).toMatchObject({
      ok: true,
      data: { task: { task_id, status: 'pending' } },
    });

    const run = harness(cwd);
    await run.run(['task', 'run', task_id, '--json']);
    expect(JSON.parse(run.stdout[0])).toMatchObject({
      ok: true,
      data: { task: { status: 'succeeded' } },
    });
  });

  it('prints errors for unsupported enqueue and non-retryable retry', async () => {
    const cwd = await create_temp_dir();
    const unsupported = harness(cwd);
    await unsupported.run(['task', 'enqueue', 'shell.command', 'anything']);
    expect(unsupported.exit_code).toBe(1);
    expect(unsupported.stderr.join('\n')).toContain('Unsupported task type');

    const enqueue = harness(cwd);
    await enqueue.run([
      'task',
      'enqueue',
      'source.process',
      'src_20260514_upload_markdown_missing',
      '--json',
    ]);
    const task_id = (
      JSON.parse(enqueue.stdout[0]) as {
        ok: true;
        data: { task: { task_id: string } };
      }
    ).data.task.task_id;
    const run = harness(cwd);
    await run.run(['task', 'run', task_id, '--json']);
    const retry = harness(cwd);
    await retry.run(['task', 'retry', task_id]);
    expect(retry.exit_code).toBe(1);
    expect(retry.stderr.join('\n')).toContain('Task is not retryable');
  });
});
