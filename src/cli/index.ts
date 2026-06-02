#!/usr/bin/env node

import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';
import type { CandidateStatus } from '../domain/candidate.js';
import type {
  DiscussionAgentOutput,
  DraftUnderstandingCandidate,
  GroundedAnswer,
  NoteCandidate,
} from '../agents/schemas.js';
import type { EmbeddingProvider } from '../agents/embedding-provider.js';
import type { LlmClient } from '../agents/types.js';
import type { CollectorResult } from '../collectors/types.js';
import type { DocumentProcessingResult } from '../processing/document-processor.js';
import type { AnswerAgentInput } from '../agents/answer-agent.js';
import { archive_note_workflow } from '../workflows/archive-note-workflow.js';
import { archive_source_workflow } from '../workflows/archive-source-workflow.js';
import type { DiscussionAgentInput } from '../agents/discussion-agent.js';
import type { NoteAgentInput } from '../agents/note-agent.js';
import type { UnderstandAgentInput } from '../agents/understand-agent.js';
import { Command } from 'commander';
import { answer_question_workflow } from '../workflows/answer-question-workflow.js';
import { approve_note_workflow } from '../workflows/approve-note-workflow.js';
import { approve_source_workflow } from '../workflows/approve-source-workflow.js';
import {
  collect_candidates_workflow,
  type CandidateCollectorProvider,
} from '../workflows/collect-candidates-workflow.js';
import { compose_note_workflow } from '../workflows/compose-note-workflow.js';
import { discover_related_notes_workflow } from '../workflows/discover-related-notes-workflow.js';
import { discuss_source_workflow } from '../workflows/discuss-source-workflow.js';
import { index_note_workflow } from '../workflows/index-note-workflow.js';
import { init_workflow } from '../workflows/init-workflow.js';
import type { FeishuDocReader } from '../workflows/feishu-doc-reader.js';
import { ingest_feishu_doc_workflow } from '../workflows/ingest-feishu-doc-workflow.js';
import { ingest_markdown_workflow } from '../workflows/ingest-markdown-workflow.js';
import { ingest_pdf_workflow } from '../workflows/ingest-pdf-workflow.js';
import { ingest_url_workflow } from '../workflows/ingest-url-workflow.js';
import { lint_note_workflow } from '../workflows/lint-note-workflow.js';
import { list_candidates_workflow } from '../workflows/list-candidates-workflow.js';
import { list_notes_workflow } from '../workflows/list-notes-workflow.js';
import { list_sources_workflow } from '../workflows/list-sources-workflow.js';
import { process_source_workflow } from '../workflows/process-source-workflow.js';
import { render_note_workflow } from '../workflows/render-note-workflow.js';
import { score_candidate_workflow } from '../workflows/score-candidate-workflow.js';
import { select_candidate_workflow } from '../workflows/select-candidate-workflow.js';
import { show_candidate_workflow } from '../workflows/show-candidate-workflow.js';
import { show_note_workflow } from '../workflows/show-note-workflow.js';
import { show_source_workflow } from '../workflows/show-source-workflow.js';
import { supersede_note_workflow } from '../workflows/supersede-note-workflow.js';
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
    embedding_provider?: EmbeddingProvider;
    repl_input?: AsyncIterable<string>;
    fetch_html?: (url: string) => Promise<string>;
    read_feishu_doc?: FeishuDocReader;
    process_pdf?: (input: {
      raw_pdf: Uint8Array;
      source_title: string;
      processed_at: string;
    }) => Promise<DocumentProcessingResult>;
    process_url?: (input: {
      raw_html: string;
      source_title: string;
      source_url: string;
      processed_at: string;
    }) => DocumentProcessingResult;
    collect_candidates?: (
      provider: CandidateCollectorProvider,
    ) => Promise<CollectorResult>;
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

  const candidate = program
    .command('candidate')
    .description('Manage Candidates.');

  const candidate_collect = candidate
    .command('collect')
    .description('Collect Candidates from external sources.');

  candidate_collect
    .command('github-trending')
    .option('--json', 'Output JSON')
    .description('Collect GitHub Trending Candidates.')
    .action(async (options: { json?: boolean }) => {
      const result = await collect_candidates_workflow({
        provider: 'github-trending',
        cwd: input.cwd,
        collect:
          input.collect_candidates === undefined
            ? undefined
            : () => input.collect_candidates!('github-trending'),
      });

      if (options.json) {
        print_json_result(result, io);
        return;
      }
      if (!handle_result(result, io)) {
        return;
      }
      print_collect_candidate_results(result.data.results, io);
    });

  candidate_collect
    .command('hacker-news')
    .option('--json', 'Output JSON')
    .description('Collect Hacker News Candidates.')
    .action(async (options: { json?: boolean }) => {
      const result = await collect_candidates_workflow({
        provider: 'hacker-news',
        cwd: input.cwd,
        collect:
          input.collect_candidates === undefined
            ? undefined
            : () => input.collect_candidates!('hacker-news'),
      });

      if (options.json) {
        print_json_result(result, io);
        return;
      }
      if (!handle_result(result, io)) {
        return;
      }
      print_collect_candidate_results(result.data.results, io);
    });

  candidate
    .command('select')
    .argument('<candidate_id>')
    .option('--json', 'Output JSON')
    .description('Select a recommended Candidate and convert it to a Source.')
    .action(async (candidate_id: string, options: { json?: boolean }) => {
      const result = await select_candidate_workflow({
        candidate_id,
        cwd: input.cwd,
      });

      if (options.json) {
        print_json_result(result, io);
        return;
      }
      if (!handle_result(result, io)) {
        return;
      }
      io.stdout(`candidate_id: ${result.data.candidate.id}`);
      print_source_summary(result.data.source, io);
      print_next_actions(result.next_actions, io);
    });

  candidate
    .command('score')
    .argument('<candidate_id>')
    .option('--json', 'Output JSON')
    .description('Score and recommend a Candidate.')
    .action(async (candidate_id: string, options: { json?: boolean }) => {
      const result = await score_candidate_workflow({
        candidate_id,
        cwd: input.cwd,
      });

      if (options.json) {
        print_json_result(result, io);
        return;
      }
      if (!handle_result(result, io)) {
        return;
      }
      print_candidate_summary(result.data.candidate, io);
    });

  candidate
    .command('list')
    .option('--status <status>', 'Filter by Candidate status')
    .option('--json', 'Output JSON')
    .description('List Candidates.')
    .action(async (options: { status?: string; json?: boolean }) => {
      const result = await list_candidates_workflow({
        status: options.status as CandidateStatus | undefined,
        cwd: input.cwd,
      });

      if (options.json) {
        print_json_result(result, io);
        return;
      }
      if (!handle_result(result, io)) {
        return;
      }
      for (const candidate_summary of result.data.candidates) {
        print_candidate_summary(candidate_summary, io);
      }
    });

  candidate
    .command('show')
    .argument('<candidate_id>')
    .option('--json', 'Output JSON')
    .description('Show Candidate summary.')
    .action(async (candidate_id: string, options: { json?: boolean }) => {
      const result = await show_candidate_workflow({
        candidate_id,
        cwd: input.cwd,
      });

      if (options.json) {
        print_json_result(result, io);
        return;
      }
      if (!handle_result(result, io)) {
        return;
      }
      print_candidate_summary(result.data.candidate, io);
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

  source_ingest
    .command('feishu-doc')
    .argument('<doc_url_or_token>')
    .option('--json', 'Output JSON')
    .description('Ingest an explicit Feishu Doc as a Source.')
    .action(async (doc_url_or_token: string, options: { json?: boolean }) => {
      const result = await ingest_feishu_doc_workflow({
        doc_url_or_token,
        cwd: input.cwd,
        read_feishu_doc: input.read_feishu_doc,
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
        process_pdf: input.process_pdf,
        process_url: input.process_url,
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
    .command('archive')
    .argument('<source_id>')
    .option('--json', 'Output JSON')
    .description('Archive a Source without deleting its artifacts.')
    .action(async (source_id: string, options: { json?: boolean }) => {
      const result = await archive_source_workflow({
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

      io.stdout('Source archived.');
      print_source_summary(result.data.source, io);
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
    .option('--related-note <note_id...>', 'Confirmed related Note id')
    .description('Compose a draft Note from an approved Source.')
    .action(
      async (
        source_id: string,
        options: { json?: boolean; relatedNote?: string[] },
      ) => {
        const result = await compose_note_workflow({
          source_id,
          cwd: input.cwd,
          compose: input.compose_note,
          confirmed_related_note_ids: options.relatedNote ?? [],
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
      },
    );

  const note_related = note
    .command('related')
    .description('Discover and confirm related Notes.');

  note_related
    .command('discover')
    .option('--note <note_id>', 'Discover related Notes for an existing Note')
    .option('--text <text>', 'Discover related Notes for source text')
    .option('--exclude <note_id...>', 'Exclude Note ids')
    .option('--json', 'Output JSON')
    .description('Discover related Note candidates from approved Notes.')
    .action(
      async (options: {
        note?: string;
        text?: string;
        exclude?: string[];
        json?: boolean;
      }) => {
        const result = await discover_related_notes_workflow({
          note_id: options.note,
          source_text: options.text,
          exclude_note_ids: options.exclude,
          cwd: input.cwd,
        });

        if (options.json) {
          print_json_result(result, io);
          return;
        }

        if (!handle_result(result, io)) {
          return;
        }

        if (result.data.candidates.length === 0) {
          io.stdout('No related note candidates found.');
          return;
        }

        for (const candidate of result.data.candidates) {
          print_related_note_candidate(candidate, io);
        }
      },
    );

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
    .option('--vector', 'Build vector index metadata')
    .description('Index an approved Note.')
    .action(
      async (
        note_id: string,
        options: { json?: boolean; vector?: boolean },
      ) => {
        const result = await index_note_workflow({
          note_id,
          cwd: input.cwd,
          include_vector: options.vector === true,
          embedding_provider: input.embedding_provider,
        });
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
        io.stdout(
          `vector_ref: ${
            result.data.vector_index_ref === null
              ? 'null'
              : result.data.vector_index_ref.path
          }`,
        );
      },
    );

  note
    .command('archive')
    .argument('<note_id>')
    .option('--json', 'Output JSON')
    .description('Archive a Note and remove it from main retrieval.')
    .action(async (note_id: string, options: { json?: boolean }) => {
      const result = await archive_note_workflow({ note_id, cwd: input.cwd });
      if (options.json) {
        print_json_result(result, io);
        return;
      }
      if (!handle_result(result, io)) {
        return;
      }
      io.stdout('Note archived.');
      print_note_summary(result.data.note, io);
    });

  note
    .command('supersede')
    .argument('<old_note_id>')
    .argument('<source_id>')
    .option('--json', 'Output JSON')
    .option('--related-note <note_id...>', 'Confirmed related Note id')
    .description(
      'Create a draft Note version that supersedes an approved Note.',
    )
    .action(
      async (
        old_note_id: string,
        source_id: string,
        options: { json?: boolean; relatedNote?: string[] },
      ) => {
        const result = await supersede_note_workflow({
          old_note_id,
          source_id,
          cwd: input.cwd,
          compose: input.compose_note,
          confirmed_related_note_ids: options.relatedNote ?? [],
        });
        if (options.json) {
          print_json_result(result, io);
          return;
        }
        if (!handle_result(result, io)) {
          return;
        }
        io.stdout('Note superseded.');
        io.stdout('Old note:');
        print_note_summary(result.data.old_note, io);
        io.stdout('New note:');
        print_note_summary(result.data.new_note, io);
        print_next_actions(result.next_actions, io);
      },
    );

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
    const command_result = await handle_discuss_command(input, message);
    if (command_result.handled) {
      if (command_result.exit) {
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

type DiscussCommandResult = {
  handled: boolean;
  exit?: boolean;
};

async function handle_discuss_command(
  input: DiscussReplInput,
  command: string,
): Promise<DiscussCommandResult> {
  if (!command.startsWith('/')) {
    return { handled: false };
  }

  if (command === '/help') {
    input.io.stdout('Commands: /summary /draft /status /approve /exit /help');
    return { handled: true };
  }
  if (command === '/exit') {
    input.io.stdout('Discussion exited.');
    return { handled: true, exit: true };
  }

  const current = await show_source_workflow({
    source_id: input.source_id,
    cwd: input.cwd,
  });
  if (!handle_result(current, input.io)) {
    return { handled: true };
  }
  const source = current.data.source;
  const raw_source = current.data.raw_source;

  if (command === '/summary') {
    input.io.stdout(JSON.stringify(raw_source.discussion_summary, null, 2));
    return { handled: true };
  }
  if (command === '/draft') {
    input.io.stdout(JSON.stringify(raw_source.draft_understanding, null, 2));
    return { handled: true };
  }
  if (command === '/status') {
    input.io.stdout(`status: ${source.status}`);
    input.io.stdout(
      `ready_for_approval: ${raw_source.discussion_summary.ready_for_approval}`,
    );
    return { handled: true };
  }
  if (command === '/approve') {
    const result = await approve_source_workflow({
      source_id: input.source_id,
      cwd: input.cwd,
    });
    if (!handle_result(result, input.io)) {
      return { handled: true };
    }

    input.io.stdout('Source approved for note.');
    print_source_summary(result.data.source, input.io);
    print_next_actions(result.next_actions, input.io);
    return { handled: true, exit: true };
  }

  input.io.stdout(`Unknown command: ${command}`);
  return { handled: true };
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
  const details = format_error_details(error.details);
  if (details !== undefined) {
    io.stderr(`  details: ${details}`);
  }
}

function format_error_details(details: unknown): string | undefined {
  if (details === undefined) {
    return undefined;
  }

  if (typeof details === 'string') {
    return details;
  }

  return JSON.stringify(details);
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

function print_collect_candidate_results(
  results: Array<
    | {
        status: 'created';
        candidate: Parameters<typeof print_candidate_summary>[0];
      }
    | {
        status: 'duplicate';
        title: string;
        reason: string;
        existing_candidate_id: string;
      }
  >,
  io: CliIo,
): void {
  for (const result of results) {
    if (result.status === 'created') {
      io.stdout(`created: ${result.candidate.id}`);
      print_candidate_summary(result.candidate, io);
    } else {
      io.stdout(
        `duplicate: ${result.title} (${result.reason}) -> ${result.existing_candidate_id}`,
      );
    }
  }
}

function print_candidate_summary(
  candidate_summary: {
    id: string;
    status: string;
    source_type: string;
    title: string;
    summary: string;
    url: string;
    score: { total: number; reason: string };
    collected_at: string;
    converted_source_id: string | null;
  },
  io: CliIo,
): void {
  io.stdout(`id: ${candidate_summary.id}`);
  io.stdout(`title: ${candidate_summary.title}`);
  io.stdout(`status: ${candidate_summary.status}`);
  io.stdout(`source_type: ${candidate_summary.source_type}`);
  io.stdout(`score: ${candidate_summary.score.total}`);
  io.stdout(`score_reason: ${candidate_summary.score.reason}`);
  io.stdout(`collected_at: ${candidate_summary.collected_at}`);
  io.stdout(`url: ${candidate_summary.url}`);
  io.stdout(
    `converted_source_id: ${candidate_summary.converted_source_id ?? ''}`,
  );
  io.stdout(`summary: ${candidate_summary.summary}`);
}

function print_related_note_candidate(
  candidate: { note_id: string; title: string; reason: string; status: string },
  io: CliIo,
): void {
  io.stdout(`note_id: ${candidate.note_id}`);
  io.stdout(`title: ${candidate.title}`);
  io.stdout(`reason: ${candidate.reason}`);
  io.stdout(`status: ${candidate.status}`);
}

function print_note_summary(
  note_summary: {
    id: string;
    title: string;
    status: string;
    updated_at: string;
    version: number;
    root_note_id: string;
    supersedes_note_id: string | null;
    superseded_by_note_id: string | null;
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
  io.stdout(`version: ${note_summary.version}`);
  io.stdout(`root_note_id: ${note_summary.root_note_id}`);
  io.stdout(`supersedes_note_id: ${note_summary.supersedes_note_id ?? ''}`);
  io.stdout(
    `superseded_by_note_id: ${note_summary.superseded_by_note_id ?? ''}`,
  );
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
