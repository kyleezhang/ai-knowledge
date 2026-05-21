import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { create_program, type CliIo } from '../cli/index.js';

const acceptance_fixture_file = new URL(
  '../../tests/p0-end-to-end-acceptance.fixture.md',
  import.meta.url,
);
const acceptance_question = 'agent memory boundary approved notes';
const discussion_user_message =
  'Please confirm the approved memory boundary we should keep in the final note.';

export type SmokeRunResult = {
  status: 'passed' | 'skipped';
  reason?: string;
  workdir?: string;
  source_id?: string;
  note_id?: string;
  answer_conclusion?: string;
};

export async function run_local_llm_smoke_test(
  input: {
    env?: NodeJS.ProcessEnv;
    keep_workdir?: boolean;
  } = {},
): Promise<SmokeRunResult> {
  const env = input.env ?? process.env;
  if ((env.DEEPSEEK_API_KEY ?? '').trim().length === 0) {
    return {
      status: 'skipped',
      reason: 'Missing DEEPSEEK_API_KEY. Local smoke test was skipped.',
    };
  }

  const workdir = await mkdtemp(path.join(os.tmpdir(), 'ai-knowledge-smoke-'));
  const fixture_content = await readFile(acceptance_fixture_file, 'utf8');
  const fixture_path = path.join(
    workdir,
    'p0-end-to-end-acceptance.fixture.md',
  );
  await writeFile(fixture_path, fixture_content, 'utf8');

  const io = create_recording_io();
  const run = async (args: string[]) => {
    reset_io(io);
    await create_program({
      io: io.handlers,
      cwd: workdir,
      repl_input: async_iter([discussion_user_message, '/approve', '/exit']),
    }).parseAsync(['node', 'ai-knowledge', ...args]);

    if (io.exit_code !== undefined && io.exit_code !== 0) {
      throw new Error(
        [
          `Command failed: ai-knowledge ${args.join(' ')}`,
          io.stderr.join('\n'),
          io.stdout.join('\n'),
        ]
          .filter((part) => part.trim().length > 0)
          .join('\n'),
      );
    }

    return io.stdout.join('\n');
  };

  let source_id: string | undefined;
  let note_id: string | undefined;
  let answer_conclusion: string | undefined;

  try {
    const ingest_json = JSON.parse(
      await run(['source', 'ingest', 'markdown', fixture_path, '--json']),
    ) as { ok: true; data: { source_id: string } };
    source_id = ingest_json.data.source_id;

    const process_json = JSON.parse(
      await run(['source', 'process', source_id, '--json']),
    ) as {
      ok: true;
      data: {
        source: {
          status: string;
          processing_artifacts: Record<string, string>;
        };
      };
    };
    assert(
      process_json.data.source.status === 'processed',
      'Smoke test expected processed source status.',
    );
    assert_has_standard_processing_artifacts(
      process_json.data.source.processing_artifacts,
    );

    const understand_json = JSON.parse(
      await run(['source', 'understand', source_id, '--json']),
    ) as {
      ok: true;
      data: {
        source: { status: string };
        draft_understanding: { summary: string; key_points: string[] };
      };
    };
    assert(
      understand_json.data.source.status === 'understanding_ready',
      'Smoke test expected understanding_ready source status.',
    );
    assert(
      understand_json.data.draft_understanding.summary.trim().length > 0,
      'Smoke test expected non-empty draft understanding summary.',
    );

    const discuss_output = await run(['source', 'discuss', source_id]);
    assert(
      discuss_output.includes('Source discussion started.'),
      'Smoke test expected discussion REPL to start.',
    );

    const approve_source_json = JSON.parse(
      await run(['source', 'approve', source_id, '--json']),
    ) as { ok: true; data: { source: { status: string } } };
    assert(
      approve_source_json.data.source.status === 'approved_for_note',
      'Smoke test expected approved_for_note source status.',
    );

    const compose_json = JSON.parse(
      await run(['note', 'compose', source_id, '--json']),
    ) as { ok: true; data: { note_id: string; note: { status: string } } };
    note_id = compose_json.data.note_id;
    assert(
      compose_json.data.note.status === 'draft',
      'Smoke test expected draft note status after compose.',
    );

    const lint_json = JSON.parse(
      await run(['note', 'lint', note_id, '--json']),
    ) as { ok: true; data: { lint: { passed: boolean } } };
    assert(lint_json.data.lint.passed, 'Smoke test expected lint to pass.');

    const approve_note_json = JSON.parse(
      await run(['note', 'approve', note_id, '--json']),
    ) as { ok: true; data: { note: { status: string } } };
    assert(
      approve_note_json.data.note.status === 'approved',
      'Smoke test expected approved note status.',
    );

    await run(['note', 'index', note_id, '--json']);

    const answer_output = await run(['answer', acceptance_question]);
    assert(
      answer_output.includes('## 综合结论'),
      'Smoke test expected grounded answer heading.',
    );
    answer_conclusion = extract_answer_conclusion(answer_output);

    return {
      status: 'passed',
      workdir,
      source_id,
      note_id,
      answer_conclusion,
    };
  } finally {
    if (!input.keep_workdir) {
      await rm(workdir, { recursive: true, force: true });
    }
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assert_has_standard_processing_artifacts(
  processing_artifacts: Record<string, string>,
): void {
  assert(
    processing_artifacts.clean_text === 'processed/clean_text.md',
    'Smoke test expected processed/clean_text.md artifact.',
  );
  assert(
    processing_artifacts.segments === 'processed/segments.json',
    'Smoke test expected processed/segments.json artifact.',
  );
  assert(
    processing_artifacts.metadata === 'processed/metadata.json',
    'Smoke test expected processed/metadata.json artifact.',
  );
}

function extract_answer_conclusion(output: string): string {
  const lines = output.split('\n');
  const heading_index = lines.findIndex(
    (line) => line.trim() === '## 综合结论',
  );
  if (heading_index === -1) {
    return '';
  }

  return lines[heading_index + 1]?.trim() ?? '';
}

type RecordingIo = {
  stdout: string[];
  stderr: string[];
  exit_code: number | undefined;
  handlers: CliIo;
};

function create_recording_io(): RecordingIo {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const state: { exit_code: number | undefined } = { exit_code: undefined };

  return {
    stdout,
    stderr,
    get exit_code() {
      return state.exit_code;
    },
    set exit_code(value: number | undefined) {
      state.exit_code = value;
    },
    handlers: {
      stdout: (message: string) => {
        stdout.push(message);
      },
      stderr: (message: string) => {
        stderr.push(message);
      },
      set_exit_code: (code: number) => {
        state.exit_code = code;
      },
    },
  };
}

function reset_io(io: RecordingIo): void {
  io.stdout.length = 0;
  io.stderr.length = 0;
  io.exit_code = undefined;
}

async function* async_iter(items: string[]): AsyncIterable<string> {
  for (const item of items) {
    yield item;
  }
}

export const __test_only__ = {
  extract_answer_conclusion,
};
