import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { DocumentProcessingResult } from '../processing/document-processor.js';
import { create_program, type CliIo } from '../cli/index.js';

const markdown_fixture_file = new URL(
  '../../tests/p0-end-to-end-acceptance.fixture.md',
  import.meta.url,
);
const markdown_question = 'agent memory boundary approved notes';
const pdf_question = 'p1 pdf locator approved notes';
const url_question = 'p1 url locator approved notes';
const url_fixture =
  '<html><head><title>P1 URL Smoke</title></head><body><article><h1>P1 URL Smoke</h1><p>URL smoke validates approved note grounding.</p></article></body></html>';

const smoke_paths = ['markdown', 'pdf', 'url'] as const;
type SmokePathLabel = (typeof smoke_paths)[number];

export type SmokePathResult = {
  path: SmokePathLabel;
  source_id: string;
  note_id: string;
  answer_conclusion: string;
};

export type SmokeRunResult =
  | {
      status: 'skipped';
      reason: string;
    }
  | {
      status: 'passed';
      workdir: string;
      paths: SmokePathResult[];
    };

type SmokePathProgramOptions = {
  fetch_html?: (url: string) => Promise<string>;
  process_pdf?: (input: {
    raw_pdf: Uint8Array;
    source_title: string;
    processed_at: string;
  }) => Promise<DocumentProcessingResult>;
};

type SmokePathConfig = {
  label: SmokePathLabel;
  question: string;
  discussion_message: string;
  ingest_args: (workdir: string) => Promise<string[]>;
  program_options?: SmokePathProgramOptions;
  validate?: (input: {
    source_id: string;
    processing_artifacts: Record<string, string>;
    workdir: string;
  }) => Promise<void>;
};

type RunCommand = (
  args: string[],
  context: SmokeCommandContext,
) => Promise<string>;

type SmokeCommandContext = {
  path_label: SmokePathLabel;
  source_id?: string;
  note_id?: string;
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
  const io = create_recording_io();
  const run: RunCommand = async (args, context) => {
    reset_io(io);
    await create_program({
      io: io.handlers,
      cwd: workdir,
      repl_input: async_iter([
        smoke_path_config(context.path_label).discussion_message,
        '/approve',
        '/exit',
      ]),
      ...smoke_path_config(context.path_label).program_options,
    }).parseAsync(['node', 'ai-knowledge', ...args]);

    if (io.exit_code !== undefined && io.exit_code !== 0) {
      throw new Error(
        format_smoke_command_error({
          path_label: context.path_label,
          args,
          workdir,
          source_id: context.source_id,
          note_id: context.note_id,
          stderr: io.stderr,
          stdout: io.stdout,
        }),
      );
    }

    return io.stdout.join('\n');
  };

  try {
    const results: SmokePathResult[] = [];
    for (const label of smoke_paths) {
      results.push(
        await run_smoke_path(smoke_path_config(label), workdir, run),
      );
    }

    return {
      status: 'passed',
      workdir,
      paths: results,
    };
  } finally {
    if (!input.keep_workdir) {
      await rm(workdir, { recursive: true, force: true });
    }
  }
}

async function run_smoke_path(
  config: SmokePathConfig,
  workdir: string,
  run: RunCommand,
): Promise<SmokePathResult> {
  const context: SmokeCommandContext = { path_label: config.label };
  const ingest_json = JSON.parse(
    await run(await config.ingest_args(workdir), context),
  ) as { ok: true; data: { source_id: string } };
  const source_id = ingest_json.data.source_id;
  context.source_id = source_id;

  const process_json = JSON.parse(
    await run(['source', 'process', source_id, '--json'], context),
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
    `${config.label} smoke expected processed source status.`,
  );
  assert_has_standard_processing_artifacts(
    process_json.data.source.processing_artifacts,
    config.label,
  );
  await config.validate?.({
    source_id,
    processing_artifacts: process_json.data.source.processing_artifacts,
    workdir,
  });

  const understand_json = JSON.parse(
    await run(['source', 'understand', source_id, '--json'], context),
  ) as {
    ok: true;
    data: {
      source: { status: string };
      draft_understanding: { summary: string; key_points: string[] };
    };
  };
  assert(
    understand_json.data.source.status === 'understanding_ready',
    `${config.label} smoke expected understanding_ready source status.`,
  );
  assert(
    understand_json.data.draft_understanding.summary.trim().length > 0,
    `${config.label} smoke expected non-empty draft understanding summary.`,
  );

  const discuss_output = await run(['source', 'discuss', source_id], context);
  assert(
    discuss_output.includes('Source discussion started.'),
    `${config.label} smoke expected discussion REPL to start.`,
  );
  assert(
    discuss_output.includes('Source approved for note.'),
    `${config.label} smoke expected discussion approval to complete.`,
  );

  const compose_json = JSON.parse(
    await run(['note', 'compose', source_id, '--json'], context),
  ) as { ok: true; data: { note_id: string; note: { status: string } } };
  const note_id = compose_json.data.note_id;
  context.note_id = note_id;
  assert(
    compose_json.data.note.status === 'draft',
    `${config.label} smoke expected draft note status after compose.`,
  );

  const lint_json = JSON.parse(
    await run(['note', 'lint', note_id, '--json'], context),
  ) as { ok: true; data: { lint: { passed: boolean } } };
  assert(
    lint_json.data.lint.passed,
    `${config.label} smoke expected lint to pass.`,
  );

  const approve_note_json = JSON.parse(
    await run(['note', 'approve', note_id, '--json'], context),
  ) as { ok: true; data: { note: { status: string } } };
  assert(
    approve_note_json.data.note.status === 'approved',
    `${config.label} smoke expected approved note status.`,
  );

  await run(['note', 'index', note_id, '--json'], context);

  const answer_output = await run(['answer', config.question], context);
  assert(
    answer_output.includes('## 综合结论'),
    `${config.label} smoke expected grounded answer heading.`,
  );
  const answer_conclusion = extract_answer_conclusion(answer_output);
  assert(
    answer_conclusion.length > 0,
    `${config.label} smoke expected non-empty answer conclusion.`,
  );

  return { path: config.label, source_id, note_id, answer_conclusion };
}

function smoke_path_config(label: SmokePathLabel): SmokePathConfig {
  switch (label) {
    case 'markdown':
      return {
        label,
        question: markdown_question,
        discussion_message:
          'I explicitly confirm this point for the final note: Only approved Notes should be indexed and used for grounded answers in the P0 workflow. There are no open questions or unresolved issues.',
        ingest_args: async (workdir) => {
          const fixture_content = await readFile(markdown_fixture_file, 'utf8');
          const fixture_path = path.join(
            workdir,
            'p0-end-to-end-acceptance.fixture.md',
          );
          await writeFile(fixture_path, fixture_content, 'utf8');
          return ['source', 'ingest', 'markdown', fixture_path, '--json'];
        },
      };
    case 'pdf':
      return {
        label,
        question: pdf_question,
        discussion_message:
          'I explicitly confirm this PDF smoke point for the final note: PDF smoke proves P1 PDF sources can become approved Notes with traceable processed evidence. There are no open questions or unresolved issues.',
        ingest_args: async (workdir) => {
          const fixture_path = path.join(workdir, 'p1-pdf-smoke.pdf');
          await writeFile(
            fixture_path,
            '%PDF-1.4\n% deterministic smoke fixture\n',
            'utf8',
          );
          return ['source', 'ingest', 'pdf', fixture_path, '--json'];
        },
        program_options: {
          process_pdf: async ({ processed_at }) =>
            build_pdf_smoke_processing_result(processed_at),
        },
        validate: async ({ source_id, workdir }) => {
          const segments = await read_segments(source_id, workdir);
          assert(
            segments[0]?.locator?.source_kind === 'pdf',
            'pdf smoke expected PDF locator metadata.',
          );
        },
      };
    case 'url':
      return {
        label,
        question: url_question,
        discussion_message:
          'I explicitly confirm this URL smoke point for the final note: URL smoke proves P1 URL sources can become approved Notes with traceable processed evidence. There are no open questions or unresolved issues.',
        ingest_args: async () => [
          'source',
          'ingest',
          'url',
          'https://example.com/p1-url-smoke',
          '--json',
        ],
        program_options: {
          fetch_html: async () => url_fixture,
        },
        validate: async ({ source_id, workdir }) => {
          const raw_html = await readFile(
            raw_html_path(source_id, workdir),
            'utf8',
          );
          assert(
            raw_html === url_fixture,
            'url smoke expected frozen HTML snapshot.',
          );
          const segments = await read_segments(source_id, workdir);
          assert(
            segments[0]?.locator?.source_kind === 'url',
            'url smoke expected URL locator metadata.',
          );
        },
      };
  }
}

function build_pdf_smoke_processing_result(
  processed_at: string,
): DocumentProcessingResult {
  return {
    clean_text: '## Page 1\n\nPDF smoke validates approved note grounding.\n',
    segments: [
      {
        id: 'seg_0001',
        order: 1,
        heading_path: ['Page 1'],
        text: 'PDF smoke validates approved note grounding.',
        locator: {
          ref: 'processed/segments.json#seg_0001',
          source_kind: 'pdf',
          position: 1,
          page: 1,
          heading_path: ['Page 1'],
        },
      },
    ],
    metadata: {
      title: 'P1 PDF Smoke',
      headings: [{ level: 2, title: 'Page 1' }],
      links: [],
      segment_count: 1,
      processed_at,
      page_count: 1,
    },
  };
}

type SmokeSegment = {
  locator?: {
    source_kind?: string;
  };
};

async function read_segments(
  source_id: string,
  workdir: string,
): Promise<SmokeSegment[]> {
  return JSON.parse(
    await readFile(
      path.join(source_processed_dir(source_id, workdir), 'segments.json'),
      'utf8',
    ),
  ) as SmokeSegment[];
}

function source_processed_dir(source_id: string, workdir: string): string {
  return path.join(source_dir(source_id, workdir), 'processed');
}

function raw_html_path(source_id: string, workdir: string): string {
  return path.join(source_dir(source_id, workdir), 'raw', 'fetched.html');
}

function source_dir(source_id: string, workdir: string): string {
  const match = /^src_(\d{4})(\d{2})\d{2}_/.exec(source_id);
  assert(match !== null, `Invalid source id in smoke: ${source_id}`);
  return path.join(
    workdir,
    'knowledge',
    'sources',
    match[1],
    match[2],
    source_id,
  );
}

function format_smoke_command_error(input: {
  path_label: SmokePathLabel;
  args: string[];
  workdir: string;
  source_id?: string;
  note_id?: string;
  stderr: string[];
  stdout: string[];
}): string {
  return [
    `Path failed: ${input.path_label}`,
    `Command failed: ai-knowledge ${input.args.join(' ')}`,
    `workdir: ${input.workdir}`,
    input.source_id === undefined ? '' : `source_id: ${input.source_id}`,
    input.note_id === undefined ? '' : `note_id: ${input.note_id}`,
    input.stderr.join('\n'),
    input.stdout.join('\n'),
  ]
    .filter((part) => part.trim().length > 0)
    .join('\n');
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assert_has_standard_processing_artifacts(
  processing_artifacts: Record<string, string>,
  path_label: SmokePathLabel,
): void {
  assert(
    processing_artifacts.clean_text === 'processed/clean_text.md',
    `${path_label} smoke expected processed/clean_text.md artifact.`,
  );
  assert(
    processing_artifacts.segments === 'processed/segments.json',
    `${path_label} smoke expected processed/segments.json artifact.`,
  );
  assert(
    processing_artifacts.metadata === 'processed/metadata.json',
    `${path_label} smoke expected processed/metadata.json artifact.`,
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
  format_smoke_command_error,
  smoke_paths,
};
