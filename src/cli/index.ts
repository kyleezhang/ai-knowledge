#!/usr/bin/env node

import { pathToFileURL } from 'node:url';
import type { DraftUnderstandingCandidate } from '../agents/schemas.js';
import type { LlmClient } from '../agents/types.js';
import type { UnderstandAgentInput } from '../agents/understand-agent.js';
import { Command } from 'commander';
import { init_workflow } from '../workflows/init-workflow.js';
import { ingest_markdown_workflow } from '../workflows/ingest-markdown-workflow.js';
import { list_sources_workflow } from '../workflows/list-sources-workflow.js';
import { process_source_workflow } from '../workflows/process-source-workflow.js';
import { show_source_workflow } from '../workflows/show-source-workflow.js';
import { understand_source_workflow } from '../workflows/understand-source-workflow.js';
import type {
  NextAction,
  WorkflowError,
  WorkflowResult,
} from '../workflows/types.js';

export type CliIo = {
  stdout: (message: string) => void;
  stderr: (message: string) => void;
  set_exit_code: (code: number) => void;
};

export function create_program(
  input: {
    io?: CliIo;
    cwd?: string;
    understand?: (input: {
      llm_client: LlmClient;
      agent_input: UnderstandAgentInput;
    }) => Promise<DraftUnderstandingCandidate>;
  } = {},
): Command {
  const io = input.io ?? default_io;
  const program = new Command();

  program
    .name('ai-knowledge')
    .description('CLI-first knowledge workflow for AI learning materials.')
    .version('0.1.0');

  program
    .command('init')
    .description('Initialize local knowledge storage directories.')
    .action(async () => {
      const result = await init_workflow({ cwd: input.cwd });

      if (!handle_result(result, io)) {
        return;
      }

      io.stdout('Knowledge storage initialized.');
      io.stdout(`Root: ${result.data.knowledge_dir}`);
    });

  const source = program.command('source').description('Manage Sources.');

  const source_ingest = source
    .command('ingest')
    .description('Ingest source material.');

  source_ingest
    .command('markdown')
    .argument('<file>')
    .option('--json', 'Output JSON')
    .description('Ingest a Markdown file as a Source.')
    .action(async (file: string, options: { json?: boolean }) => {
      const result = await ingest_markdown_workflow({
        file_path: file,
        cwd: input.cwd,
      });

      if (options.json) {
        print_json_result(result, io);
        return;
      }

      if (!handle_result(result, io)) {
        return;
      }

      io.stdout('Source ingested.');
      print_source_summary(result.data.source, io);
      print_next_actions(result.next_actions, io);
    });

  source
    .command('process')
    .argument('<source_id>')
    .option('--json', 'Output JSON')
    .description('Process a Markdown Source into artifacts.')
    .action(async (source_id: string, options: { json?: boolean }) => {
      const result = await process_source_workflow({
        source_id,
        cwd: input.cwd,
      });

      if (options.json) {
        print_json_result(result, io);
        return;
      }

      if (!handle_result(result, io)) {
        return;
      }

      io.stdout('Source processed.');
      print_source_summary(result.data.source, io);
      print_next_actions(result.next_actions, io);
    });

  source
    .command('understand')
    .argument('<source_id>')
    .option('--show', 'Show full draft understanding')
    .option('--json', 'Output JSON')
    .description('Generate draft understanding for a processed Source.')
    .action(
      async (
        source_id: string,
        options: { show?: boolean; json?: boolean },
      ) => {
        const result = await understand_source_workflow({
          source_id,
          cwd: input.cwd,
          understand: input.understand,
        });

        if (options.json) {
          print_json_result(result, io);
          return;
        }

        if (!handle_result(result, io)) {
          return;
        }

        io.stdout('Draft understanding ready.');
        print_source_summary(result.data.source, io);
        if (options.show) {
          print_draft_understanding(result.data.draft_understanding, io);
        }
        print_next_actions(result.next_actions, io);
      },
    );

  source
    .command('list')
    .option('--status <status>')
    .option('--json', 'Output JSON')
    .description('List Sources.')
    .action(async (options: { status?: string; json?: boolean }) => {
      const result = await list_sources_workflow({
        status: options.status as never,
        cwd: input.cwd,
      });

      if (options.json) {
        print_json_result(result, io);
        return;
      }

      if (!handle_result(result, io)) {
        return;
      }

      if (result.data.sources.length === 0) {
        io.stdout('No sources found.');
        return;
      }

      for (const item of result.data.sources) {
        io.stdout(
          `${item.id}\t${item.status}\t${item.updated_at}\t${item.title}`,
        );
      }
    });

  source
    .command('show')
    .argument('<source_id>')
    .option('--json', 'Output JSON')
    .description('Show Source control summary.')
    .action(async (source_id: string, options: { json?: boolean }) => {
      const result = await show_source_workflow({
        source_id,
        cwd: input.cwd,
      });

      if (options.json) {
        print_json_result(result, io);
        return;
      }

      if (!handle_result(result, io)) {
        return;
      }

      print_source_summary(result.data.source, io);
    });

  return program;
}

const default_io: CliIo = {
  stdout: (message) => console.log(message),
  stderr: (message) => console.error(message),
  set_exit_code: (code) => {
    process.exitCode = code;
  },
};

function handle_result<T>(
  result: WorkflowResult<T>,
  io: CliIo,
): result is Extract<WorkflowResult<T>, { ok: true }> {
  if (result.ok) {
    return true;
  }

  print_error(result.error, io);
  io.set_exit_code(1);
  return false;
}

function print_json_result<T>(result: WorkflowResult<T>, io: CliIo): void {
  io.stdout(JSON.stringify(result, null, 2));
  if (!result.ok) {
    io.set_exit_code(1);
  }
}

function print_error(error: WorkflowError, io: CliIo): void {
  io.stderr('Cannot complete command:');
  io.stderr(`  reason: ${error.message}`);
  io.stderr(`  code: ${error.code}`);
}

function print_next_actions(
  next_actions: NextAction[] | undefined,
  io: CliIo,
): void {
  if (next_actions === undefined || next_actions.length === 0) {
    return;
  }

  io.stdout('Next:');
  for (const action of next_actions) {
    io.stdout(`  ${action.label}: ${action.command}`);
  }
}

function print_draft_understanding(
  draft: {
    summary: string;
    key_points: string[];
    uncertainties: string[];
    discussion_starters: string[];
    generated_at: string;
  },
  io: CliIo,
): void {
  io.stdout('draft_understanding:');
  io.stdout(`  summary: ${draft.summary}`);
  io.stdout(`  key_points: ${JSON.stringify(draft.key_points)}`);
  io.stdout(`  uncertainties: ${JSON.stringify(draft.uncertainties)}`);
  io.stdout(
    `  discussion_starters: ${JSON.stringify(draft.discussion_starters)}`,
  );
  io.stdout(`  generated_at: ${draft.generated_at}`);
}

function print_source_summary(
  source_summary: {
    id: string;
    title: string;
    status: string;
    ingest_type: string;
    content_type: string;
    updated_at: string;
    processing_artifacts: Record<string, string>;
    draft_understanding_summary: string | null;
    discussion_status: string;
    note_ids: string[];
  },
  io: CliIo,
): void {
  io.stdout(`id: ${source_summary.id}`);
  io.stdout(`title: ${source_summary.title}`);
  io.stdout(`status: ${source_summary.status}`);
  io.stdout(`ingest_type: ${source_summary.ingest_type}`);
  io.stdout(`content_type: ${source_summary.content_type}`);
  io.stdout(`updated_at: ${source_summary.updated_at}`);
  io.stdout(
    `processing_artifacts: ${JSON.stringify(source_summary.processing_artifacts)}`,
  );
  io.stdout(
    `draft_understanding_summary: ${source_summary.draft_understanding_summary ?? ''}`,
  );
  io.stdout(`discussion_status: ${source_summary.discussion_status}`);
  io.stdout(`note_ids: ${source_summary.note_ids.join(',')}`);
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await create_program().parseAsync(process.argv);
}
