import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { create_program, type CliIo } from '../../src/cli/index.js';
import type { FeishuDocReader } from '../../src/workflows/feishu-doc-reader.js';
import type {
  DiscussionAgentOutput,
  DraftUnderstandingCandidate,
  GroundedAnswer,
  NoteCandidate,
} from '../../src/agents/schemas.js';
import type { LlmClient } from '../../src/agents/types.js';
import type { DocumentProcessingResult } from '../../src/processing/document-processor.js';
import type { AnswerAgentInput } from '../../src/agents/answer-agent.js';
import type { DiscussionAgentInput } from '../../src/agents/discussion-agent.js';
import type { NoteAgentInput } from '../../src/agents/note-agent.js';
import type { UnderstandAgentInput } from '../../src/agents/understand-agent.js';
import {
  create_temp_dir,
  write_markdown_fixture,
  write_pdf_fixture,
} from '../source-test-helpers.js';

const example_article_html =
  '<html><head><title>Example Article</title></head><body><article><h1>Example Article</h1><p>Read <a href="/docs">docs</a>.</p></article></body></html>';

async function fetch_html_fixture(): Promise<string> {
  return example_article_html;
}

async function reject_fetch_fixture(): Promise<string> {
  throw new Error('auth required');
}

const read_feishu_doc_fixture: FeishuDocReader = async () => ({
  title: 'CLI Feishu Doc',
  document_type: 'docx',
  markdown: '# CLI Feishu Doc\n\nBody.\n',
  raw_snapshot: { title: 'CLI Feishu Doc' },
});

const reject_feishu_doc_fixture: FeishuDocReader = async () => {
  throw new Error('permission denied');
};

function source_id_from_output(output: string): string {
  const json = JSON.parse(output) as { ok: true; data: { source_id: string } };
  return json.data.source_id;
}

async function process_pdf_source(
  cwd: string,
  source_id: string,
): Promise<void> {
  const { process_source_workflow } =
    await import('../../src/workflows/process-source-workflow.js');

  await process_source_workflow({
    cwd,
    source_id,
    process_pdf: process_pdf_fixture,
  });
}

async function process_pdf_fixture(): Promise<DocumentProcessingResult> {
  return {
    clean_text: '## Page 1\n\nPDF body.\n',
    segments: [
      {
        id: 'seg_0001',
        order: 1,
        heading_path: ['Page 1'],
        text: 'PDF body.',
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
      title: 'PDF Title',
      headings: [{ level: 2, title: 'Page 1' }],
      links: [],
      segment_count: 1,
      processed_at: '2026-05-14T01:00:00.000Z',
      page_count: 1,
    },
  };
}

async function process_url_source(
  cwd: string,
  source_id: string,
): Promise<void> {
  const { process_source_workflow } =
    await import('../../src/workflows/process-source-workflow.js');

  await process_source_workflow({
    cwd,
    source_id,
    process_url: process_url_fixture,
  });
}

function process_url_fixture(): DocumentProcessingResult {
  return {
    clean_text: '# Example Article\n\nRead [docs](https://example.com/docs).\n',
    segments: [
      {
        id: 'seg_0001',
        order: 1,
        heading_path: ['Example Article'],
        text: 'Read [docs](https://example.com/docs).',
        locator: {
          ref: 'processed/segments.json#seg_0001',
          source_kind: 'url',
          position: 1,
          heading_path: ['Example Article'],
          section: 'example-article',
        },
      },
    ],
    metadata: {
      title: 'Example Article',
      headings: [{ level: 1, title: 'Example Article' }],
      links: [{ text: 'docs', url: 'https://example.com/docs' }],
      segment_count: 1,
      processed_at: '2026-05-14T01:10:00.000Z',
      source_url: 'https://example.com/article',
    },
  };
}

async function understand_with_capture(
  cwd: string,
  source_id: string,
  captured: Array<{ source_metadata: unknown; segments: unknown }>,
): Promise<void> {
  const { understand_source_workflow } =
    await import('../../src/workflows/understand-source-workflow.js');

  await understand_source_workflow({
    cwd,
    source_id,
    understand: async ({ agent_input }) => {
      captured.push({
        source_metadata: agent_input.source_metadata,
        segments: agent_input.segments,
      });
      return {
        summary: 'Summary',
        key_points: ['Point'],
        uncertainties: ['Unclear'],
        discussion_starters: ['Question?'],
      };
    },
  });
}

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

  it('ingests PDF with human-readable output', async () => {
    const cwd = await create_temp_dir();
    const file_path = await write_pdf_fixture(cwd, 'paper.pdf');
    const harness = create_cli_harness(cwd);

    await harness.run(['source', 'ingest', 'pdf', file_path]);

    expect(harness.stdout.join('\n')).toContain('Source ingested.');
    expect(harness.stdout.join('\n')).toContain('ingest_type: upload_pdf');
    expect(harness.stdout.join('\n')).toContain('content_type: document');
    expect(harness.stdout.join('\n')).toContain('ai-knowledge source process');
  });

  it('ingests URL with human-readable output', async () => {
    const cwd = await create_temp_dir();
    const harness = create_cli_harness(cwd, { fetch_html: fetch_html_fixture });

    await harness.run([
      'source',
      'ingest',
      'url',
      'https://example.com/article',
    ]);

    expect(harness.stdout.join('\n')).toContain('Source ingested.');
    expect(harness.stdout.join('\n')).toContain('ingest_type: input_url');
    expect(harness.stdout.join('\n')).toContain('content_type: link');
    expect(harness.stdout.join('\n')).toContain('ai-knowledge source process');
  });

  it('ingests Feishu Doc with human-readable output', async () => {
    const cwd = await create_temp_dir();
    const harness = create_cli_harness(cwd, {
      read_feishu_doc: read_feishu_doc_fixture,
    });

    await harness.run(['source', 'ingest', 'feishu-doc', 'doc_token']);

    expect(harness.stdout.join('\n')).toContain('Source ingested.');
    expect(harness.stdout.join('\n')).toContain('ingest_type: feishu_doc');
    expect(harness.stdout.join('\n')).toContain('content_type: document');
    expect(harness.stdout.join('\n')).toContain('ai-knowledge source process');
  });

  it('ingests Feishu Doc with JSON output', async () => {
    const cwd = await create_temp_dir();
    const harness = create_cli_harness(cwd, {
      read_feishu_doc: read_feishu_doc_fixture,
    });

    await harness.run([
      'source',
      'ingest',
      'feishu-doc',
      'doc_token',
      '--json',
    ]);

    const output = JSON.parse(harness.stdout[0]) as {
      ok: true;
      data: { source_id: string; source: { ingest_type: string } };
      next_actions: Array<{ command: string }>;
    };
    expect(output.ok).toBe(true);
    expect(output.data.source.ingest_type).toBe('feishu_doc');
    expect(output.next_actions[0]?.command).toContain(
      `ai-knowledge source process ${output.data.source_id}`,
    );
  });

  it('rejects Feishu Doc ingest when the document cannot be read', async () => {
    const cwd = await create_temp_dir();
    const harness = create_cli_harness(cwd, {
      read_feishu_doc: reject_feishu_doc_fixture,
    });

    await harness.run(['source', 'ingest', 'feishu-doc', 'doc_token']);

    expect(harness.exit_code).toBe(1);
    expect(harness.stderr.join('\n')).toContain('code: INVALID_INPUT');
  });

  it('rejects URL ingest when the page cannot be fetched', async () => {
    const cwd = await create_temp_dir();
    const harness = create_cli_harness(cwd, {
      fetch_html: reject_fetch_fixture,
    });

    await harness.run([
      'source',
      'ingest',
      'url',
      'https://example.com/private',
    ]);

    expect(harness.exit_code).toBe(1);
    expect(harness.stderr.join('\n')).toContain('code: INVALID_INPUT');
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

  it('runs discussion REPL built-in commands and exits', async () => {
    const cwd = await create_temp_dir();
    const source_id = await ingest_process_understand(
      cwd,
      '# Discuss CLI\n\nBody.\n',
    );
    const harness = create_cli_harness(cwd, {
      repl_input: async_iter([
        '/status',
        '/summary',
        '/draft',
        '/help',
        '/exit',
      ]),
    });

    await harness.run(['source', 'discuss', source_id]);

    const output = harness.stdout.join('\n');
    expect(output).toContain('Source discussion started.');
    expect(output).toContain('ready_for_approval: false');
    expect(output).toContain('Draft summary');
    expect(output).toContain(
      'Commands: /summary /draft /status /approve /exit /help',
    );
    expect(output).toContain('Discussion exited.');
  });

  it('dispatches normal REPL input to discussion workflow', async () => {
    const cwd = await create_temp_dir();
    const source_id = await ingest_process_understand(
      cwd,
      '# Discuss Message\n\nBody.\n',
    );
    const harness = create_cli_harness(cwd, {
      repl_input: async_iter(['This matters.', '/exit']),
      discuss: async ({ agent_input }) => ({
        assistant_message: `Reply: ${agent_input.user_message}`,
        discussion_summary_update: {
          confirmed_points: ['Confirmed'],
          open_questions: [],
          unresolved_issues: [],
          next_prompts: [],
          ready_for_approval: true,
        },
      }),
    });

    await harness.run(['source', 'discuss', source_id]);

    expect(harness.stdout.join('\n')).toContain('Reply: This matters.');
  });

  it('approves directly in REPL only after convergence', async () => {
    const cwd = await create_temp_dir();
    const missing_points_source_id = await ingest_process_understand(
      cwd,
      '# Approve Missing Points\n\nBody.\n',
    );
    const missing_points = create_cli_harness(cwd, {
      repl_input: async_iter(['Need more discussion.', '/approve', '/exit']),
      discuss: async () => ({
        assistant_message: 'Need more confirmation.',
        discussion_summary_update: {
          confirmed_points: [],
          open_questions: [],
          unresolved_issues: [],
          next_prompts: [],
          ready_for_approval: false,
        },
      }),
    });
    await missing_points.run(['source', 'discuss', missing_points_source_id]);
    expect(missing_points.stderr.join('\n')).toContain(
      'Discussion has not converged and cannot be approved.',
    );
    expect(missing_points.stderr.join('\n')).toContain(
      'missing_confirmed_points',
    );

    const blocked_source_id = await ingest_process_understand(
      cwd,
      '# Blocked Approve\n\nBody.\n',
    );
    const blocked_confirm = create_cli_harness(cwd, {
      repl_input: async_iter(['Confirm this.', '/approve', '/exit']),
      discuss: async () => ({
        assistant_message: 'We have enough confirmed points.',
        discussion_summary_update: {
          confirmed_points: ['Confirmed'],
          open_questions: ['Question'],
          unresolved_issues: ['Issue'],
          next_prompts: [],
          ready_for_approval: true,
        },
      }),
    });
    await blocked_confirm.run(['source', 'discuss', blocked_source_id]);
    const blocked_error = blocked_confirm.stderr.join('\n');
    expect(blocked_error).toContain(
      'Discussion has not converged and cannot be approved.',
    );
    expect(blocked_error).toContain('open_questions_present');
    expect(blocked_error).toContain('unresolved_issues_present');

    const ready_source_id = await ingest_process_understand(
      cwd,
      '# Ready Approve\n\nBody.\n',
    );
    const ready = create_cli_harness(cwd, {
      repl_input: async_iter(['Confirm again.', '/approve', '/exit']),
      discuss: async () => ({
        assistant_message: 'Ready now.',
        discussion_summary_update: {
          confirmed_points: ['Confirmed'],
          open_questions: [],
          unresolved_issues: [],
          next_prompts: [],
          ready_for_approval: true,
        },
      }),
    });
    await ready.run(['source', 'discuss', ready_source_id]);
    const ready_output = ready.stdout.join('\n');
    expect(ready_output).toContain('Source approved for note.');
    expect(ready_output).toContain('status: approved_for_note');
  });

  it('understands PDF and URL sources from normalized artifacts only', async () => {
    const cwd = await create_temp_dir();
    const pdf_harness = create_cli_harness(cwd);
    const pdf_file_path = await write_pdf_fixture(cwd, 'paper.pdf');
    await pdf_harness.run(['source', 'ingest', 'pdf', pdf_file_path, '--json']);
    const pdf_source_id = source_id_from_output(pdf_harness.stdout[0]);
    await process_pdf_source(cwd, pdf_source_id);

    const url_harness = create_cli_harness(cwd, {
      fetch_html: fetch_html_fixture,
    });
    await url_harness.run([
      'source',
      'ingest',
      'url',
      'https://example.com/article',
      '--json',
    ]);
    const url_source_id = source_id_from_output(url_harness.stdout[0]);
    await process_url_source(cwd, url_source_id);

    const captured: Array<{ source_metadata: unknown; segments: unknown }> = [];
    await understand_with_capture(cwd, pdf_source_id, captured);
    await understand_with_capture(cwd, url_source_id, captured);

    expect(captured).toHaveLength(2);
    expect(captured[0].source_metadata).toMatchObject({ page_count: 1 });
    expect(captured[1].source_metadata).toMatchObject({
      source_url: 'https://example.com/article',
    });
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

  it('supports JSON output for PDF source process', async () => {
    const cwd = await create_temp_dir();
    const file_path = await write_pdf_fixture(cwd, 'paper.pdf');
    const ingest_harness = create_cli_harness(cwd);
    await ingest_harness.run(['source', 'ingest', 'pdf', file_path, '--json']);
    const source_id = source_id_from_output(ingest_harness.stdout[0]);
    const process_harness = create_cli_harness(cwd, {
      process_pdf: process_pdf_fixture,
    });

    await process_harness.run(['source', 'process', source_id, '--json']);

    expect(JSON.parse(process_harness.stdout[0])).toMatchObject({
      ok: true,
      data: {
        source: {
          ingest_type: 'upload_pdf',
          status: 'processed',
          processing_artifacts: {
            clean_text: 'processed/clean_text.md',
            segments: 'processed/segments.json',
            metadata: 'processed/metadata.json',
          },
        },
      },
    });
  });

  it('processes Feishu Doc with human-readable output', async () => {
    const cwd = await create_temp_dir();
    const ingest_harness = create_cli_harness(cwd, {
      read_feishu_doc: read_feishu_doc_fixture,
    });
    await ingest_harness.run([
      'source',
      'ingest',
      'feishu-doc',
      'doc_token',
      '--json',
    ]);
    const source_id = source_id_from_output(ingest_harness.stdout[0]);
    const process_harness = create_cli_harness(cwd);

    await process_harness.run(['source', 'process', source_id]);

    expect(process_harness.stdout.join('\n')).toContain('Source processed.');
    expect(process_harness.stdout.join('\n')).toContain(
      'ingest_type: feishu_doc',
    );
    expect(process_harness.stdout.join('\n')).toContain('status: processed');
    expect(process_harness.stdout.join('\n')).toContain(
      'processed/clean_text.md',
    );
    expect(process_harness.stdout.join('\n')).toContain(
      `ai-knowledge source understand ${source_id}`,
    );
  });

  it('supports JSON output for Feishu Doc source process', async () => {
    const cwd = await create_temp_dir();
    const ingest_harness = create_cli_harness(cwd, {
      read_feishu_doc: read_feishu_doc_fixture,
    });
    await ingest_harness.run([
      'source',
      'ingest',
      'feishu-doc',
      'doc_token',
      '--json',
    ]);
    const source_id = source_id_from_output(ingest_harness.stdout[0]);
    const process_harness = create_cli_harness(cwd);

    await process_harness.run(['source', 'process', source_id, '--json']);

    expect(JSON.parse(process_harness.stdout[0])).toMatchObject({
      ok: true,
      data: {
        source: {
          ingest_type: 'feishu_doc',
          status: 'processed',
          processing_artifacts: {
            clean_text: 'processed/clean_text.md',
            segments: 'processed/segments.json',
            metadata: 'processed/metadata.json',
          },
        },
      },
      next_actions: [
        {
          command: `ai-knowledge source understand ${source_id}`,
        },
      ],
    });
  });

  it('supports JSON output for URL ingest and process', async () => {
    const cwd = await create_temp_dir();
    const ingest_harness = create_cli_harness(cwd, {
      fetch_html: fetch_html_fixture,
    });
    await ingest_harness.run([
      'source',
      'ingest',
      'url',
      'https://example.com/article',
      '--json',
    ]);
    const source_id = source_id_from_output(ingest_harness.stdout[0]);

    expect(JSON.parse(ingest_harness.stdout[0])).toMatchObject({
      ok: true,
      data: {
        source_id,
        source: {
          ingest_type: 'input_url',
          content_type: 'link',
          status: 'ingested',
        },
      },
      next_actions: [{ command: `ai-knowledge source process ${source_id}` }],
    });

    const process_harness = create_cli_harness(cwd, {
      process_url: process_url_fixture,
    });
    await process_harness.run(['source', 'process', source_id, '--json']);

    expect(JSON.parse(process_harness.stdout[0])).toMatchObject({
      ok: true,
      data: {
        source: {
          ingest_type: 'input_url',
          status: 'processed',
          processing_artifacts: {
            clean_text: 'processed/clean_text.md',
            segments: 'processed/segments.json',
            metadata: 'processed/metadata.json',
          },
        },
      },
      next_actions: [
        { command: `ai-knowledge source understand ${source_id}` },
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

  it('approves a ready Source discussion with human-readable output', async () => {
    const cwd = await create_temp_dir();
    const source_id = await ingest_process_understand(
      cwd,
      '# Approve CLI\n\nBody.\n',
    );
    await make_discussion_ready(cwd, source_id);
    const harness = create_cli_harness(cwd);

    await harness.run(['source', 'approve', source_id]);

    const output = harness.stdout.join('\n');
    expect(output).toContain('Source approved for note.');
    expect(output).toContain('status: approved_for_note');
    expect(output).toContain('discussion_status: closed');
    expect(output).toContain(`ai-knowledge note compose ${source_id}`);
  });

  it('supports JSON output for source approve', async () => {
    const cwd = await create_temp_dir();
    const source_id = await ingest_process_understand(
      cwd,
      '# Approve JSON\n\nBody.\n',
    );
    await make_discussion_ready(cwd, source_id);
    const harness = create_cli_harness(cwd);

    await harness.run(['source', 'approve', source_id, '--json']);

    expect(JSON.parse(harness.stdout[0])).toMatchObject({
      ok: true,
      data: { source: { status: 'approved_for_note' } },
      next_actions: [{ command: `ai-knowledge note compose ${source_id}` }],
    });
  });

  it('archives Sources with text and JSON output and keeps archived Sources visible', async () => {
    const cwd = await create_temp_dir();
    const text_source_id = await ingest_and_process(
      cwd,
      '# Archive Source\n\nBody.\n',
    );
    const json_source_id = await ingest_and_process(
      cwd,
      '# Archive JSON Source\n\nBody.\n',
    );
    const text = create_cli_harness(cwd);
    const json = create_cli_harness(cwd);

    await text.run(['source', 'archive', text_source_id]);
    await json.run(['source', 'archive', json_source_id, '--json']);

    expect(text.stdout.join('\n')).toContain('Source archived.');
    expect(text.stdout.join('\n')).toContain('status: archived');
    expect(JSON.parse(json.stdout[0])).toMatchObject({
      ok: true,
      data: { source: { status: 'archived' } },
    });

    const list = create_cli_harness(cwd);
    await list.run(['source', 'list', '--status', 'archived']);
    expect(list.stdout.join('\n')).toContain(text_source_id);
    expect(list.stdout.join('\n')).toContain(json_source_id);

    const show = create_cli_harness(cwd);
    await show.run(['source', 'show', text_source_id]);
    expect(show.stdout.join('\n')).toContain('status: archived');
  });

  it('prints structured errors for source archive failures', async () => {
    const cwd = await create_temp_dir();
    const source_id = await ingest_and_process(
      cwd,
      '# Archive Twice\n\nBody.\n',
    );
    const first = create_cli_harness(cwd);
    await first.run(['source', 'archive', source_id]);

    const repeated = create_cli_harness(cwd);
    await repeated.run(['source', 'archive', source_id]);
    const missing = create_cli_harness(cwd);
    await missing.run([
      'source',
      'archive',
      'src_20260514_upload_markdown_missing',
    ]);

    expect(repeated.exit_code).toBe(1);
    expect(repeated.stderr.join('\n')).toContain('code: INVALID_STATE');
    expect(missing.exit_code).toBe(1);
    expect(missing.stderr.join('\n')).toContain('code: NOT_FOUND');
  });

  it('prints structured errors for source approve failures', async () => {
    const cwd = await create_temp_dir();
    const source_id = await ingest_process_understand(
      cwd,
      '# Approve Error\n\nBody.\n',
    );
    const wrong_status = create_cli_harness(cwd);

    await wrong_status.run(['source', 'approve', source_id]);

    expect(wrong_status.exit_code).toBe(1);
    expect(wrong_status.stderr.join('\n')).toContain('code: INVALID_STATE');

    const no_points_source_id = await ingest_process_understand(
      cwd,
      '# Approve No Points\n\nBody.\n',
    );
    const no_points_discussion = create_cli_harness(cwd, {
      repl_input: async_iter(['No confirmed points yet.', '/exit']),
      discuss: async () => ({
        assistant_message: 'Need more confirmation.',
        discussion_summary_update: {
          confirmed_points: [],
          open_questions: [],
          unresolved_issues: [],
          next_prompts: [],
          ready_for_approval: false,
        },
      }),
    });
    await no_points_discussion.run(['source', 'discuss', no_points_source_id]);
    const no_points = create_cli_harness(cwd);

    await no_points.run(['source', 'approve', no_points_source_id]);

    expect(no_points.exit_code).toBe(1);
    expect(no_points.stderr.join('\n')).toContain(
      'Discussion has not converged and cannot be approved.',
    );
    expect(no_points.stderr.join('\n')).toContain('missing_confirmed_points');
  });

  it('composes, renders, lists, and shows Notes', async () => {
    const cwd = await create_temp_dir();
    const source_id = await create_approved_source(cwd);
    const compose_harness = create_cli_harness(cwd, {
      compose_note: async ({ agent_input }) => ({
        title: 'CLI Note',
        conclusions: agent_input.discussion_summary.confirmed_points,
        why_it_matters: ['It matters.'],
        current_understanding: 'Current understanding.',
        open_questions: [],
        related_note_ids: [],
        source_refs: agent_input.source_refs,
      }),
    });

    await compose_harness.run(['note', 'compose', source_id]);

    expect(compose_harness.stdout.join('\n')).toContain('Note composed.');
    expect(compose_harness.stdout.join('\n')).toContain('status: draft');
    const note_id_match = /id: (note_\S+)/u.exec(
      compose_harness.stdout.join('\n'),
    );
    expect(note_id_match).not.toBeNull();
    const note_id = note_id_match![1];

    const render_harness = create_cli_harness(cwd);
    await render_harness.run(['note', 'render', note_id]);
    expect(render_harness.stdout.join('\n')).toContain('Note rendered.');

    const list_harness = create_cli_harness(cwd);
    await list_harness.run(['note', 'list', '--status', 'draft']);
    expect(list_harness.stdout.join('\n')).toContain(note_id);

    const show_harness = create_cli_harness(cwd);
    await show_harness.run(['note', 'show', note_id]);
    expect(show_harness.stdout.join('\n')).toContain('conclusions:');
    expect(show_harness.stdout.join('\n')).not.toContain('## 当前理解');
  });

  it('discovers related Notes and composes with a confirmed related note', async () => {
    const cwd = await create_temp_dir();
    const related_note_id = await compose_cli_note(cwd, 'Agent Memory Related');
    await lint_cli_note(cwd, related_note_id);
    const approve_harness = create_cli_harness(cwd);
    await approve_harness.run(['note', 'approve', related_note_id]);

    const discover_harness = create_cli_harness(cwd);
    await discover_harness.run([
      'note',
      'related',
      'discover',
      '--text',
      'agent memory related learning',
    ]);

    const discover_output = discover_harness.stdout.join('\n');
    expect(discover_output).toContain(`note_id: ${related_note_id}`);
    expect(discover_output).toContain('reason: Shares approved note keywords');
    expect(discover_output).toContain('status: pending');

    const source_id = await create_approved_source(cwd);
    const compose_harness = create_cli_harness(cwd, {
      compose_note: async ({ agent_input }) => ({
        title: 'With Related Note',
        conclusions: agent_input.discussion_summary.confirmed_points,
        why_it_matters: ['It matters.'],
        current_understanding: 'Current understanding.',
        open_questions: [],
        related_note_ids: [related_note_id],
        source_refs: agent_input.source_refs,
      }),
    });

    await compose_harness.run([
      'note',
      'compose',
      source_id,
      '--related-note',
      related_note_id,
      '--json',
    ]);

    const compose_json = JSON.parse(compose_harness.stdout[0]) as {
      ok: true;
      data: { note: { related_note_ids: string[] } };
    };
    expect(compose_json.data.note.related_note_ids).toEqual([related_note_id]);
  });

  it('supports JSON output for related note discovery', async () => {
    const cwd = await create_temp_dir();
    const related_note_id = await compose_cli_note(cwd, 'JSON Related Agent');
    await lint_cli_note(cwd, related_note_id);
    const approve_harness = create_cli_harness(cwd);
    await approve_harness.run(['note', 'approve', related_note_id]);
    const discover_harness = create_cli_harness(cwd);

    await discover_harness.run([
      'note',
      'related',
      'discover',
      '--text',
      'json related agent',
      '--json',
    ]);

    const output = JSON.parse(discover_harness.stdout[0]) as {
      ok: true;
      data: { candidates: Array<{ note_id: string; status: string }> };
    };
    expect(output.data.candidates).toEqual([
      expect.objectContaining({ note_id: related_note_id, status: 'pending' }),
    ]);
  });

  it('supports JSON output for note compose/render/list/show', async () => {
    const cwd = await create_temp_dir();
    const source_id = await create_approved_source(cwd);
    const compose_harness = create_cli_harness(cwd, {
      compose_note: async ({ agent_input }) => ({
        title: 'JSON Note',
        conclusions: agent_input.discussion_summary.confirmed_points,
        why_it_matters: ['It matters.'],
        current_understanding: 'Current understanding.',
        open_questions: [],
        related_note_ids: [],
        source_refs: agent_input.source_refs,
      }),
    });

    await compose_harness.run(['note', 'compose', source_id, '--json']);
    const compose_json = JSON.parse(compose_harness.stdout[0]) as {
      ok: true;
      data: { note_id: string };
    };

    const render_harness = create_cli_harness(cwd);
    await render_harness.run([
      'note',
      'render',
      compose_json.data.note_id,
      '--json',
    ]);
    const list_harness = create_cli_harness(cwd);
    await list_harness.run(['note', 'list', '--json']);
    const show_harness = create_cli_harness(cwd);
    await show_harness.run([
      'note',
      'show',
      compose_json.data.note_id,
      '--json',
    ]);

    expect(JSON.parse(render_harness.stdout[0])).toMatchObject({ ok: true });
    expect(JSON.parse(list_harness.stdout[0])).toMatchObject({
      ok: true,
      data: { notes: [{ id: compose_json.data.note_id }] },
    });
    expect(JSON.parse(show_harness.stdout[0])).toMatchObject({
      ok: true,
      data: { note: { id: compose_json.data.note_id, status: 'draft' } },
    });
  });

  it('prints note command errors', async () => {
    const cwd = await create_temp_dir();
    const source_id = await ingest_process_understand(
      cwd,
      '# Note Error\n\nBody.\n',
    );
    const compose_harness = create_cli_harness(cwd, {
      compose_note: async () => ({
        title: 'Bad Note',
        conclusions: ['Confirmed'],
        why_it_matters: [],
        current_understanding: '',
        open_questions: [],
        related_note_ids: [],
        source_refs: [],
      }),
    });

    await compose_harness.run(['note', 'compose', source_id]);

    expect(compose_harness.exit_code).toBe(1);
    expect(compose_harness.stderr.join('\n')).toContain('code: INVALID_INPUT');
  });

  it('lints a draft note with human-readable output', async () => {
    const cwd = await create_temp_dir();
    const note_id = await compose_cli_note(cwd, 'Lint CLI Note');
    const harness = create_cli_harness(cwd);

    await harness.run(['note', 'lint', note_id]);

    expect(harness.stdout.join('\n')).toContain('Note lint passed.');
    expect(harness.stdout.join('\n')).toContain('status: draft');
    expect(harness.stdout.join('\n')).toContain(
      `ai-knowledge note approve ${note_id}`,
    );
  });

  it('supports JSON output for note lint', async () => {
    const cwd = await create_temp_dir();
    const note_id = await compose_cli_note(cwd, 'Lint JSON Note');
    const harness = create_cli_harness(cwd);

    await harness.run(['note', 'lint', note_id, '--json']);

    expect(JSON.parse(harness.stdout[0])).toMatchObject({
      ok: true,
      data: {
        note_id,
        lint: { passed: true },
      },
      next_actions: [{ command: `ai-knowledge note approve ${note_id}` }],
    });
  });

  it('prints note lint failures', async () => {
    const cwd = await create_temp_dir();
    const note_id = await compose_cli_note(cwd, 'Lint Fail Note');
    const render_harness = create_cli_harness(cwd);
    await render_harness.run(['note', 'render', note_id]);
    const { save_note_markdown } =
      await import('../../src/storage/note-repo.js');
    await save_note_markdown(note_id, '# Broken\n', { cwd });
    const harness = create_cli_harness(cwd);

    await harness.run(['note', 'lint', note_id]);

    expect(harness.exit_code).toBe(1);
    expect(harness.stdout.join('\n')).toContain('Note lint failed.');
    expect(harness.stderr.join('\n')).toContain('code: QA_FAILED');
  });

  it('rejects lint for non-draft note', async () => {
    const cwd = await create_temp_dir();
    const note_id = await compose_cli_note(cwd, 'Archived Lint Note');
    const { get_note, save_note } =
      await import('../../src/storage/note-repo.js');
    const note = await get_note(note_id, { cwd });
    await save_note({ ...note, status: 'archived' }, { cwd });
    const harness = create_cli_harness(cwd);

    await harness.run(['note', 'lint', note_id]);

    expect(harness.exit_code).toBe(1);
    expect(harness.stderr.join('\n')).toContain('code: INVALID_STATE');
  });

  it('approves and indexes notes with human-readable output', async () => {
    const cwd = await create_temp_dir();
    const note_id = await compose_cli_note(cwd, 'Approve Index CLI Note');
    await lint_cli_note(cwd, note_id);
    const approve_harness = create_cli_harness(cwd);

    await approve_harness.run(['note', 'approve', note_id]);

    expect(approve_harness.stdout.join('\n')).toContain('Note approved.');
    expect(approve_harness.stdout.join('\n')).toContain('status: approved');
    expect(approve_harness.stdout.join('\n')).toContain(
      `ai-knowledge note index ${note_id}`,
    );

    const index_harness = create_cli_harness(cwd);
    await index_harness.run(['note', 'index', note_id]);
    expect(index_harness.stdout.join('\n')).toContain('Note indexed.');
    expect(index_harness.stdout.join('\n')).toContain(`note_id: ${note_id}`);
  });

  it('supports JSON output for note approve and index', async () => {
    const cwd = await create_temp_dir();
    const note_id = await compose_cli_note(cwd, 'Approve Index JSON Note');
    await lint_cli_note(cwd, note_id);
    const approve_harness = create_cli_harness(cwd);
    await approve_harness.run(['note', 'approve', note_id, '--json']);
    const index_harness = create_cli_harness(cwd);
    await index_harness.run(['note', 'index', note_id, '--json']);

    expect(JSON.parse(approve_harness.stdout[0])).toMatchObject({
      ok: true,
      data: { note: { status: 'approved' } },
      next_actions: [{ command: `ai-knowledge note index ${note_id}` }],
    });
    expect(JSON.parse(index_harness.stdout[0])).toMatchObject({
      ok: true,
      data: { index_entry: { note_id, status: 'approved', vector_ref: null } },
    });
  });

  it('archives Notes with text and JSON output and keeps archived Notes visible', async () => {
    const cwd = await create_temp_dir();
    const text_note_id = await create_indexed_note(cwd, 'Archive Note CLI');
    const json_note_id = await create_indexed_note(cwd, 'Archive Note JSON');
    const text = create_cli_harness(cwd);
    const json = create_cli_harness(cwd);

    await text.run(['note', 'archive', text_note_id]);
    await json.run(['note', 'archive', json_note_id, '--json']);

    expect(text.stdout.join('\n')).toContain('Note archived.');
    expect(text.stdout.join('\n')).toContain('status: archived');
    expect(JSON.parse(json.stdout[0])).toMatchObject({
      ok: true,
      data: { note: { status: 'archived' }, index_entry_removed: true },
    });

    const list = create_cli_harness(cwd);
    await list.run(['note', 'list', '--status', 'archived']);
    expect(list.stdout.join('\n')).toContain(text_note_id);
    expect(list.stdout.join('\n')).toContain(json_note_id);

    const show = create_cli_harness(cwd);
    await show.run(['note', 'show', text_note_id]);
    expect(show.stdout.join('\n')).toContain('status: archived');
  });

  it('prints structured errors for note archive failures', async () => {
    const cwd = await create_temp_dir();
    const note_id = await compose_cli_note(cwd, 'Archive Twice Note');
    const first = create_cli_harness(cwd);
    await first.run(['note', 'archive', note_id]);

    const repeated = create_cli_harness(cwd);
    await repeated.run(['note', 'archive', note_id]);
    const missing = create_cli_harness(cwd);
    await missing.run(['note', 'archive', 'note_20260514_missing-note']);

    expect(repeated.exit_code).toBe(1);
    expect(repeated.stderr.join('\n')).toContain('code: INVALID_STATE');
    expect(missing.exit_code).toBe(1);
    expect(missing.stderr.join('\n')).toContain('code: NOT_FOUND');
  });

  it('supersedes Notes with text and JSON output and shows version chain fields', async () => {
    const cwd = await create_temp_dir();
    const text_note_id = await create_indexed_note(cwd, 'Supersede CLI Old');
    const json_note_id = await create_indexed_note(cwd, 'Supersede JSON Old');
    const text_source_id = await create_approved_source(cwd);
    const json_source_id = await create_approved_source(cwd);
    const text = create_cli_harness(cwd, {
      compose_note: async ({ agent_input }) => ({
        title: 'Supersede CLI New',
        conclusions: agent_input.discussion_summary.confirmed_points,
        why_it_matters: ['It matters.'],
        current_understanding: 'Current understanding.',
        open_questions: [],
        related_note_ids: [],
        source_refs: agent_input.source_refs,
      }),
    });
    const json = create_cli_harness(cwd, {
      compose_note: async ({ agent_input }) => ({
        title: 'Supersede JSON New',
        conclusions: agent_input.discussion_summary.confirmed_points,
        why_it_matters: ['It matters.'],
        current_understanding: 'Current understanding.',
        open_questions: [],
        related_note_ids: [],
        source_refs: agent_input.source_refs,
      }),
    });

    await text.run(['note', 'supersede', text_note_id, text_source_id]);
    await json.run([
      'note',
      'supersede',
      json_note_id,
      json_source_id,
      '--json',
    ]);

    const text_output = text.stdout.join('\n');
    expect(text_output).toContain('Note superseded.');
    expect(text_output).toContain('Old note:');
    expect(text_output).toContain('status: superseded');
    expect(text_output).toContain('New note:');
    expect(text_output).toContain('status: draft');
    expect(text_output).toContain('version: 2');
    const json_output = JSON.parse(json.stdout[0]) as {
      ok: true;
      data: {
        new_note_id: string;
        old_note: { status: string };
        new_note: { version: number };
      };
    };
    expect(json_output.data.old_note.status).toBe('superseded');
    expect(json_output.data.new_note.version).toBe(2);

    const show = create_cli_harness(cwd);
    await show.run(['note', 'show', json_output.data.new_note_id]);
    const show_output = show.stdout.join('\n');
    expect(show_output).toContain('version: 2');
    expect(show_output).toContain(`supersedes_note_id: ${json_note_id}`);
  });

  it('prints structured errors for note supersede failures', async () => {
    const cwd = await create_temp_dir();
    const note_id = await compose_cli_note(cwd, 'Draft Cannot Supersede');
    const source_id = await create_approved_source(cwd);
    const draft_old = create_cli_harness(cwd);
    await draft_old.run(['note', 'supersede', note_id, source_id]);
    const missing = create_cli_harness(cwd);
    await missing.run([
      'note',
      'supersede',
      'note_20260514_missing-note',
      source_id,
    ]);

    expect(draft_old.exit_code).toBe(1);
    expect(draft_old.stderr.join('\n')).toContain('code: INVALID_STATE');
    expect(missing.exit_code).toBe(1);
    expect(missing.stderr.join('\n')).toContain('code: NOT_FOUND');
  });

  it('rejects invalid note approve and index requests', async () => {
    const cwd = await create_temp_dir();
    const note_id = await compose_cli_note(cwd, 'Approve Index Error Note');
    const approve_harness = create_cli_harness(cwd);
    await approve_harness.run(['note', 'approve', note_id]);
    expect(approve_harness.exit_code).toBe(1);
    expect(approve_harness.stderr.join('\n')).toContain('code: INVALID_STATE');

    const index_harness = create_cli_harness(cwd);
    await index_harness.run(['note', 'index', note_id]);
    expect(index_harness.exit_code).toBe(1);
    expect(index_harness.stderr.join('\n')).toContain('code: INVALID_STATE');
  });

  it('answers with no confirmed knowledge when no index matches', async () => {
    const cwd = await create_temp_dir();
    const harness = create_cli_harness(cwd);

    await harness.run(['answer', 'unknown question']);

    expect(harness.stdout.join('\n')).toContain('没有相关已确认知识');
  });

  it('answers from approved indexed notes', async () => {
    const cwd = await create_temp_dir();
    const note_id = await create_indexed_note(cwd, 'Answer CLI Note');
    const harness = create_cli_harness(cwd, {
      answer: async ({ agent_input }) => ({
        conclusion: 'Grounded conclusion.',
        cited_notes: agent_input.approved_notes.map((note) => ({
          note_id: note.id,
          title: note.title,
          relevant_points: note.conclusions,
        })),
        unconfirmed_materials: [],
        limitations: ['P0 keyword retrieval only.'],
      }),
    });

    await harness.run(['answer', 'answer cli', '--top-k', '1']);

    const output = harness.stdout.join('\n');
    expect(output).toContain('Grounded conclusion.');
    expect(output).toContain(note_id);
    expect(output).toContain('P0 keyword retrieval only.');
  });

  it('supports JSON output for answer', async () => {
    const cwd = await create_temp_dir();
    const note_id = await create_indexed_note(cwd, 'Answer JSON Note');
    const harness = create_cli_harness(cwd, {
      answer: async ({ agent_input }) => ({
        conclusion: 'JSON conclusion.',
        cited_notes: agent_input.approved_notes.map((note) => ({
          note_id: note.id,
          title: note.title,
          relevant_points: note.conclusions,
        })),
        unconfirmed_materials: [],
        limitations: [],
      }),
    });

    await harness.run(['answer', 'answer json', '--json']);

    expect(JSON.parse(harness.stdout[0])).toMatchObject({
      ok: true,
      data: {
        matched_note_ids: [note_id],
        answer: { conclusion: 'JSON conclusion.' },
      },
    });
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

async function ingest_process_understand(
  cwd: string,
  content: string,
): Promise<string> {
  const source_id = await ingest_and_process(cwd, content);
  const understand_harness = create_cli_harness(cwd, {
    understand: async () => ({
      summary: 'Draft summary',
      key_points: ['Draft point'],
      uncertainties: [],
      discussion_starters: [],
    }),
  });
  await understand_harness.run(['source', 'understand', source_id]);
  return source_id;
}

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

async function compose_cli_note(cwd: string, title: string): Promise<string> {
  const source_id = await create_approved_source(cwd);
  const compose_harness = create_cli_harness(cwd, {
    compose_note: async ({ agent_input }) => ({
      title,
      conclusions: agent_input.discussion_summary.confirmed_points,
      why_it_matters: ['It matters.'],
      current_understanding: 'Current understanding.',
      open_questions: [],
      related_note_ids: [],
      source_refs: agent_input.source_refs,
    }),
  });
  await compose_harness.run(['note', 'compose', source_id, '--json']);
  const json = JSON.parse(compose_harness.stdout[0]) as {
    ok: true;
    data: { note_id: string };
  };
  return json.data.note_id;
}

async function create_indexed_note(
  cwd: string,
  title: string,
): Promise<string> {
  const note_id = await compose_cli_note(cwd, title);
  await lint_cli_note(cwd, note_id);
  const approve_harness = create_cli_harness(cwd);
  await approve_harness.run(['note', 'approve', note_id]);
  const index_harness = create_cli_harness(cwd);
  await index_harness.run(['note', 'index', note_id]);
  return note_id;
}

async function lint_cli_note(cwd: string, note_id: string): Promise<void> {
  const lint_harness = create_cli_harness(cwd);
  await lint_harness.run(['note', 'lint', note_id]);
}

async function create_approved_source(cwd: string): Promise<string> {
  const source_id = await ingest_process_understand(
    cwd,
    '# Approved Source\n\nBody.\n',
  );
  await make_discussion_ready(cwd, source_id);
  const approve_harness = create_cli_harness(cwd);
  await approve_harness.run(['source', 'approve', source_id]);
  return source_id;
}

async function make_discussion_ready(
  cwd: string,
  source_id: string,
): Promise<void> {
  const harness = create_cli_harness(cwd, {
    repl_input: async_iter(['Ready now.', '/exit']),
    discuss: async () => ({
      assistant_message: 'Ready.',
      discussion_summary_update: {
        confirmed_points: ['Confirmed'],
        open_questions: [],
        unresolved_issues: [],
        next_prompts: [],
        ready_for_approval: true,
      },
    }),
  });
  await harness.run(['source', 'discuss', source_id]);
}

async function* async_iter(items: string[]): AsyncIterable<string> {
  for (const item of items) {
    yield item;
  }
}

function create_cli_harness(
  cwd: string,
  options: {
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
        discuss: options.discuss,
        compose_note: options.compose_note,
        answer: options.answer,
        repl_input: options.repl_input,
        fetch_html: options.fetch_html,
        read_feishu_doc: options.read_feishu_doc,
        process_pdf: options.process_pdf,
        process_url: options.process_url,
      }).parseAsync(['node', 'ai-knowledge', ...args]);
    },
  };
}
