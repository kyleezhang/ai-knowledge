#!/usr/bin/env node

import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';
import type {
  DiscussionAgentOutput,
  DraftUnderstandingCandidate,
  GroundedAnswer,
  NoteCandidate,
} from '../agents/schemas.js';
import type { LlmClient } from '../agents/types.js';
import type { AnswerAgentInput } from '../agents/answer-agent.js';
import type { DiscussionAgentInput } from '../agents/discussion-agent.js';
import type { NoteAgentInput } from '../agents/note-agent.js';
import type { UnderstandAgentInput } from '../agents/understand-agent.js';
import { Command } from 'commander';
import { answer_question_workflow } from '../workflows/answer-question-workflow.js';
import { approve_note_workflow } from '../workflows/approve-note-workflow.js';
import { approve_source_workflow } from '../workflows/approve-source-workflow.js';
import { compose_note_workflow } from '../workflows/compose-note-workflow.js';
import { discuss_source_workflow } from '../workflows/discuss-source-workflow.js';
import { index_note_workflow } from '../workflows/index-note-workflow.js';
import { init_workflow } from '../workflows/init-workflow.js';
import { ingest_markdown_workflow } from '../workflows/ingest-markdown-workflow.js';
import { ingest_pdf_workflow } from '../workflows/ingest-pdf-workflow.js';
import { ingest_url_workflow } from '../workflows/ingest-url-workflow.js';
import { lint_note_workflow } from '../workflows/lint-note-workflow.js';
import { list_notes_workflow } from '../workflows/list-notes-workflow.js';
import { list_sources_workflow } from '../workflows/list-sources-workflow.js';
import { process_source_workflow } from '../workflows/process-source-workflow.js';
import { render_note_workflow } from '../workflows/render-note-workflow.js';
import { show_note_workflow } from '../workflows/show-note-workflow.js';
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
    discuss?: (input: {
      llm_client: LlmClient;
      agent_input: DiscussionAgentInput;
    }) => Promise<DiscussionAgentOutput>;
    compose_note?: (input: {
      llm_client: LlmClient;
      agent_input: NoteAgentInput;
    }) => Promise<NoteCandidate>;
    answer?: (input: {
      llm_client: LlmClient;
      agent_input: AnswerAgentInput;
    }) => Promise<GroundedAnswer>;
    repl_input?: AsyncIterable<string>;
    fetch_html?: (url: string) => Promise<string>;
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

  program
    .command('answer')
    .argument('<question>')
    .option('--top-k <n>', 'Maximum approved Notes to retrieve')
    .option('--json', 'Output JSON')
    .description('Answer a question from approved Notes.')
    .action(
      async (question: string, options: { topK?: string; json?: boolean }) => {
        const top_k =
          options.topK === undefined ? undefined : Number(options.topK);
        const result = await answer_question_workflow({
          question,
          top_k,
          cwd: input.cwd,
          answer: input.answer,
        });

        if (options.json) {
          print_json_result(result, io);
          return;
        }
        if (!handle_result(result, io)) {
          return;
        }
        print_grounded_answer(result.data.answer, io);
      },
    );

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

  source_ingest
    .command('pdf')
    .argument('<file>')
    .option('--json', 'Output JSON')
    .description('Ingest a PDF file as a Source.')
    .action(async (file: string, options: { json?: boolean }) => {
      const result = await ingest_pdf_workflow({
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

  source_ingest
    .command('url')
    .argument('<public_url>')
    .option('--json', 'Output JSON')
    .description('Ingest an explicit public URL as a Source.')
    .action(async (public_url: string, options: { json?: boolean }) => {
      const result = await ingest_url_workflow({
        url: public_url,
        cwd: input.cwd,
        fetch_html: input.fetch_html,
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
    .description('Process an ingested Source into artifacts.')
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
    .command('discuss')
    .argument('<source_id>')
    .description('Discuss a Source interactively.')
    .action(async (source_id: string) => {
      await run_discuss_repl({
        source_id,
        cwd: input.cwd,
        io,
        input: input.repl_input,
        discuss: input.discuss,
      });
    });

  source
    .command('approve')
    .argument('<source_id>')
    .option('--json', 'Output JSON')
    .description('Approve a converged Source discussion for note composition.')
    .action(async (source_id: string, options: { json?: boolean }) => {
      const result = await approve_source_workflow({
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

      io.stdout('Source approved for note.');
      print_source_summary(result.data.source, io);
      print_next_actions(result.next_actions, io);
    });

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

  const note = program.command('note').description('Manage Notes.');

  note
    .command('compose')
    .argument('<source_id>')
    .option('--json', 'Output JSON')
    .description('Compose a draft Note from an approved Source.')
    .action(async (source_id: string, options: { json?: boolean }) => {
      const result = await compose_note_workflow({
        source_id,
        cwd: input.cwd,
        compose: input.compose_note,
      });

      if (options.json) {
        print_json_result(result, io);
        return;
      }

      if (!handle_result(result, io)) {
        return;
      }

      io.stdout('Note composed.');
      print_note_summary(result.data.note, io);
      print_next_actions(result.next_actions, io);
    });

  note
    .command('render')
    .argument('<note_id>')
    .option('--json', 'Output JSON')
    .description('Render note.md from note.json.')
    .action(async (note_id: string, options: { json?: boolean }) => {
      const result = await render_note_workflow({ note_id, cwd: input.cwd });
      if (options.json) {
        print_json_result(result, io);
        return;
      }
      if (!handle_result(result, io)) {
        return;
      }
      io.stdout('Note rendered.');
      print_note_summary(result.data.note, io);
    });

  note
    .command('lint')
    .argument('<note_id>')
    .option('--json', 'Output JSON')
    .description('Run QA lint for a draft Note.')
    .action(async (note_id: string, options: { json?: boolean }) => {
      const result = await lint_note_workflow({ note_id, cwd: input.cwd });
      if (options.json) {
        print_json_result(result, io);
        return;
      }
      if (result.ok) {
        io.stdout('Note lint passed.');
        print_note_summary(result.data.note, io);
        print_next_actions(result.next_actions, io);
        return;
      }
      io.stdout('Note lint failed.');
      if (result.error.details !== undefined) {
        io.stdout(`failures: ${JSON.stringify(result.error.details)}`);
      }
      print_error(result.error, io);
      io.set_exit_code(1);
    });

  note
    .command('approve')
    .argument('<note_id>')
    .option('--json', 'Output JSON')
    .description('Approve a draft Note that passed lint.')
    .action(async (note_id: string, options: { json?: boolean }) => {
      const result = await approve_note_workflow({ note_id, cwd: input.cwd });
      if (options.json) {
        print_json_result(result, io);
        return;
      }
      if (!handle_result(result, io)) {
        return;
      }
      io.stdout('Note approved.');
      print_note_summary(result.data.note, io);
      print_next_actions(result.next_actions, io);
    });

  note
    .command('index')
    .argument('<note_id>')
    .option('--json', 'Output JSON')
    .description('Index an approved Note.')
    .action(async (note_id: string, options: { json?: boolean }) => {
      const result = await index_note_workflow({ note_id, cwd: input.cwd });
      if (options.json) {
        print_json_result(result, io);
        return;
      }
      if (!handle_result(result, io)) {
        return;
      }
      io.stdout('Note indexed.');
      io.stdout(`note_id: ${result.data.index_entry.note_id}`);
      io.stdout(`summary: ${result.data.index_entry.summary}`);
    });

  note
    .command('list')
    .option('--status <status>')
    .option('--json', 'Output JSON')
    .description('List Notes.')
    .action(async (options: { status?: string; json?: boolean }) => {
      const result = await list_notes_workflow({
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
      if (result.data.notes.length === 0) {
        io.stdout('No notes found.');
        return;
      }
      for (const item of result.data.notes) {
        io.stdout(
          `${item.id}\t${item.status}\t${item.updated_at}\t${item.title}`,
        );
      }
    });

  note
    .command('show')
    .argument('<note_id>')
    .option('--json', 'Output JSON')
    .description('Show Note control summary.')
    .action(async (note_id: string, options: { json?: boolean }) => {
      const result = await show_note_workflow({ note_id, cwd: input.cwd });
      if (options.json) {
        print_json_result(result, io);
        return;
      }
      if (!handle_result(result, io)) {
        return;
      }
      print_note_summary(result.data.note, io);
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

type DiscussReplInput = {
  source_id: string;
  cwd?: string;
  io: CliIo;
  input?: AsyncIterable<string>;
  discuss?: (input: {
    llm_client: LlmClient;
    agent_input: DiscussionAgentInput;
  }) => Promise<DiscussionAgentOutput>;
};

async function run_discuss_repl(input: DiscussReplInput): Promise<void> {
  const initial = await show_source_workflow({
    source_id: input.source_id,
    cwd: input.cwd,
  });
  if (!handle_result(initial, input.io)) {
    return;
  }

  input.io.stdout('Source discussion started.');
  print_source_summary(initial.data.source, input.io);
  input.io.stdout('Commands: /summary /draft /status /approve /exit /help');

  for await (const line of input.input ?? default_repl_input()) {
    const message = line.trim();
    if (message.length === 0) {
      continue;
    }
    if (await handle_discuss_command(input, message)) {
      if (message === '/exit') {
        return;
      }
      continue;
    }

    const result = await discuss_source_workflow({
      source_id: input.source_id,
      user_message: message,
      cwd: input.cwd,
      discuss: input.discuss,
    });
    if (!handle_result(result, input.io)) {
      continue;
    }
    input.io.stdout(result.data.assistant_message);
  }
}

async function handle_discuss_command(
  input: DiscussReplInput,
  command: string,
): Promise<boolean> {
  if (!command.startsWith('/')) {
    return false;
  }

  if (command === '/help') {
    input.io.stdout('Commands: /summary /draft /status /approve /exit /help');
    return true;
  }
  if (command === '/exit') {
    input.io.stdout('Discussion exited.');
    return true;
  }

  const current = await show_source_workflow({
    source_id: input.source_id,
    cwd: input.cwd,
  });
  if (!handle_result(current, input.io)) {
    return true;
  }
  const source = current.data.source;
  const raw_source = current.data.raw_source;

  if (command === '/summary') {
    input.io.stdout(JSON.stringify(raw_source.discussion_summary, null, 2));
    return true;
  }
  if (command === '/draft') {
    input.io.stdout(JSON.stringify(raw_source.draft_understanding, null, 2));
    return true;
  }
  if (command === '/status') {
    input.io.stdout(`status: ${source.status}`);
    input.io.stdout(
      `ready_for_approval: ${raw_source.discussion_summary.ready_for_approval}`,
    );
    return true;
  }
  if (command === '/approve') {
    const summary = raw_source.discussion_summary;
    if (summary.confirmed_points.length === 0) {
      input.io.stdout(
        'Discussion is missing confirmed_points and cannot be approved yet.',
      );
      return true;
    }

    const has_blocking_questions =
      summary.open_questions.length > 0 || summary.unresolved_issues.length > 0;

    if (summary.ready_for_approval) {
      input.io.stdout(
        `Ready for approval. Next: ai-knowledge source approve ${input.source_id}`,
      );
      return true;
    }

    if (has_blocking_questions) {
      input.io.stdout(
        'Discussion still has open questions or unresolved issues before approval.',
      );
      return true;
    }

    input.io.stdout(
      `Model readiness is still false, but you can explicitly confirm now. Next: ai-knowledge source approve ${input.source_id}`,
    );
    return true;
  }

  input.io.stdout(`Unknown command: ${command}`);
  return true;
}

async function* default_repl_input(): AsyncIterable<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  rl.setPrompt('> ');
  rl.prompt();
  try {
    for await (const line of rl) {
      yield line;
      rl.prompt();
    }
  } finally {
    rl.close();
  }
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

function print_grounded_answer(answer: GroundedAnswer, io: CliIo): void {
  io.stdout('## 综合结论');
  io.stdout(answer.conclusion);
  io.stdout('## 依据的已确认笔记');
  for (const note of answer.cited_notes) {
    io.stdout(
      `- ${note.title} (${note.note_id}): ${note.relevant_points.join('; ')}`,
    );
  }
  io.stdout('## 不足与边界');
  for (const limitation of answer.limitations) {
    io.stdout(`- ${limitation}`);
  }
}

function print_note_summary(
  note_summary: {
    id: string;
    title: string;
    status: string;
    updated_at: string;
    conclusions: string[];
    source_refs: unknown[];
    related_note_ids: string[];
    quality_checks: unknown;
  },
  io: CliIo,
): void {
  io.stdout(`id: ${note_summary.id}`);
  io.stdout(`title: ${note_summary.title}`);
  io.stdout(`status: ${note_summary.status}`);
  io.stdout(`updated_at: ${note_summary.updated_at}`);
  io.stdout(`conclusions: ${JSON.stringify(note_summary.conclusions)}`);
  io.stdout(`source_refs: ${JSON.stringify(note_summary.source_refs)}`);
  io.stdout(`related_note_ids: ${note_summary.related_note_ids.join(',')}`);
  io.stdout(`quality_checks: ${JSON.stringify(note_summary.quality_checks)}`);
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
