import { readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { read_discussion_messages } from '../../src/storage/discussion-log.js';
import { get_source } from '../../src/storage/source-repo.js';
import { approve_source_workflow } from '../../src/workflows/approve-source-workflow.js';
import { discuss_source_workflow } from '../../src/workflows/discuss-source-workflow.js';
import { ingest_markdown_workflow } from '../../src/workflows/ingest-markdown-workflow.js';
import { list_sources_workflow } from '../../src/workflows/list-sources-workflow.js';
import { process_source_workflow } from '../../src/workflows/process-source-workflow.js';
import { understand_source_workflow } from '../../src/workflows/understand-source-workflow.js';
import { show_source_workflow } from '../../src/workflows/show-source-workflow.js';
import {
  create_temp_dir,
  write_markdown_fixture,
} from '../source-test-helpers.js';

describe('source workflows', () => {
  it('ingests Markdown and returns a process next action', async () => {
    const cwd = await create_temp_dir();
    const file_path = await write_markdown_fixture(
      cwd,
      'input.md',
      '---\ntitle: "Frontmatter Title"\n---\n\n# H1 Title\n\nBody.\n',
    );

    const result = await ingest_markdown_workflow({
      file_path,
      cwd,
      now: new Date('2026-05-14T00:00:00.000Z'),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.source_id).toBe(
      'src_20260514_upload_markdown_frontmatter-title',
    );
    expect(result.data.source.title).toBe('Frontmatter Title');
    expect(result.data.source.status).toBe('ingested');
    expect(result.data.source.processing_artifacts).toEqual({});
    expect(result.data.source.draft_understanding_summary).toBeNull();
    expect(result.next_actions).toEqual([
      {
        label: 'Process source',
        command:
          'ai-knowledge source process src_20260514_upload_markdown_frontmatter-title',
      },
    ]);
  });

  it('does not create a Source for invalid Markdown input', async () => {
    const cwd = await create_temp_dir();
    const file_path = path.join(cwd, 'input.txt');
    await writeFile(file_path, 'not markdown\n', 'utf8');

    const result = await ingest_markdown_workflow({ file_path, cwd });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe('INVALID_INPUT');
    await expect(
      readdir(path.join(cwd, 'knowledge', 'sources')),
    ).rejects.toThrow();
  });

  it('lists and shows Sources without mutating workflow state', async () => {
    const cwd = await create_temp_dir();
    const file_path = await write_markdown_fixture(cwd, 'input.md');
    const ingest_result = await ingest_markdown_workflow({
      file_path,
      cwd,
      now: new Date('2026-05-14T00:00:00.000Z'),
    });
    expect(ingest_result.ok).toBe(true);
    if (!ingest_result.ok) {
      return;
    }

    const list_result = await list_sources_workflow({
      cwd,
      status: 'ingested',
    });
    const show_result = await show_source_workflow({
      cwd,
      source_id: ingest_result.data.source_id,
    });

    expect(list_result.ok).toBe(true);
    expect(show_result.ok).toBe(true);
    if (!list_result.ok || !show_result.ok) {
      return;
    }

    expect(list_result.data.sources).toHaveLength(1);
    expect(show_result.data.source.status).toBe('ingested');
    expect(show_result.data.source.processing_artifacts).toEqual({});
    expect(show_result.data.source.draft_understanding_summary).toBeNull();
  });

  it('processes Markdown into artifacts and advances Source state', async () => {
    const cwd = await create_temp_dir();
    const file_path = await write_markdown_fixture(
      cwd,
      'input.md',
      '# Process Me\n\nBody with [link](https://example.com).\n',
    );
    const ingest_result = await ingest_markdown_workflow({
      file_path,
      cwd,
      now: new Date('2026-05-14T00:00:00.000Z'),
    });
    expect(ingest_result.ok).toBe(true);
    if (!ingest_result.ok) {
      return;
    }

    const result = await process_source_workflow({
      cwd,
      source_id: ingest_result.data.source_id,
      now: new Date('2026-05-14T01:00:00.000Z'),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.source.status).toBe('processed');
    expect(result.data.source.processing_artifacts).toEqual({
      clean_text: 'processed/clean_text.md',
      segments: 'processed/segments.json',
      metadata: 'processed/metadata.json',
    });
    expect(result.next_actions).toEqual([
      {
        label: 'Understand source',
        command: `ai-knowledge source understand ${ingest_result.data.source_id}`,
      },
    ]);
  });

  it('rejects processing when Source is not ingested', async () => {
    const cwd = await create_temp_dir();
    const file_path = await write_markdown_fixture(cwd);
    const ingest_result = await ingest_markdown_workflow({ file_path, cwd });
    expect(ingest_result.ok).toBe(true);
    if (!ingest_result.ok) {
      return;
    }

    const first_result = await process_source_workflow({
      cwd,
      source_id: ingest_result.data.source_id,
    });
    expect(first_result.ok).toBe(true);

    const second_result = await process_source_workflow({
      cwd,
      source_id: ingest_result.data.source_id,
    });

    expect(second_result.ok).toBe(false);
    if (second_result.ok) {
      return;
    }
    expect(second_result.error.code).toBe('INVALID_STATE');
  });

  it('marks Source failed when raw Markdown is missing', async () => {
    const cwd = await create_temp_dir();
    const file_path = await write_markdown_fixture(cwd);
    const ingest_result = await ingest_markdown_workflow({
      file_path,
      cwd,
      now: new Date('2026-05-14T00:00:00.000Z'),
    });
    expect(ingest_result.ok).toBe(true);
    if (!ingest_result.ok) {
      return;
    }

    await rm(
      path.join(
        cwd,
        'knowledge',
        'sources',
        '2026',
        '05',
        ingest_result.data.source_id,
        'raw',
        'original.md',
      ),
    );

    const result = await process_source_workflow({
      cwd,
      source_id: ingest_result.data.source_id,
      now: new Date('2026-05-14T01:00:00.000Z'),
    });
    const source = await get_source(ingest_result.data.source_id, { cwd });

    expect(result.ok).toBe(false);
    expect(source.status).toBe('failed');
    expect(source.last_error?.stage).toBe('processing');
  });

  it('marks Source failed when processor fails', async () => {
    const cwd = await create_temp_dir();
    const file_path = await write_markdown_fixture(cwd);
    const ingest_result = await ingest_markdown_workflow({ file_path, cwd });
    expect(ingest_result.ok).toBe(true);
    if (!ingest_result.ok) {
      return;
    }

    const result = await process_source_workflow({
      cwd,
      source_id: ingest_result.data.source_id,
      processor: () => {
        throw new Error('processor failed');
      },
    });
    const source = await get_source(ingest_result.data.source_id, { cwd });

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.code).toBe('PROCESSING_FAILED');
    expect(source.status).toBe('failed');
    expect(source.last_error?.message).toBe('processor failed');
  });

  it('marks Source failed when artifact write fails', async () => {
    const cwd = await create_temp_dir();
    const file_path = await write_markdown_fixture(cwd);
    const ingest_result = await ingest_markdown_workflow({ file_path, cwd });
    expect(ingest_result.ok).toBe(true);
    if (!ingest_result.ok) {
      return;
    }

    const result = await process_source_workflow({
      cwd,
      source_id: ingest_result.data.source_id,
      write_artifacts: async () => {
        throw new Error('artifact write failed');
      },
    });
    const source = await get_source(ingest_result.data.source_id, { cwd });

    expect(result.ok).toBe(false);
    expect(source.status).toBe('failed');
    expect(source.last_error?.message).toBe('artifact write failed');
  });

  it('generates draft understanding and advances Source state', async () => {
    const cwd = await create_temp_dir();
    const file_path = await write_markdown_fixture(
      cwd,
      'input.md',
      '# Understand Me\n\nBody.\n',
    );
    const ingest_result = await ingest_markdown_workflow({
      file_path,
      cwd,
      now: new Date('2026-05-14T00:00:00.000Z'),
    });
    expect(ingest_result.ok).toBe(true);
    if (!ingest_result.ok) {
      return;
    }
    const process_result = await process_source_workflow({
      cwd,
      source_id: ingest_result.data.source_id,
      now: new Date('2026-05-14T01:00:00.000Z'),
    });
    expect(process_result.ok).toBe(true);

    const result = await understand_source_workflow({
      cwd,
      source_id: ingest_result.data.source_id,
      now: new Date('2026-05-14T02:00:00.000Z'),
      understand: async ({ agent_input }) => ({
        summary: `Summary for ${agent_input.source_title}`,
        key_points: ['Point'],
        uncertainties: ['Unclear'],
        discussion_starters: ['Question?'],
      }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.source.status).toBe('understanding_ready');
    expect(result.data.draft_understanding).toEqual({
      summary: 'Summary for Understand Me',
      key_points: ['Point'],
      uncertainties: ['Unclear'],
      discussion_starters: ['Question?'],
      generated_at: '2026-05-14T02:00:00.000Z',
    });
    expect(result.next_actions).toEqual([
      {
        label: 'Discuss source',
        command: `ai-knowledge source discuss ${ingest_result.data.source_id}`,
      },
    ]);
  });

  it('rejects understanding when Source is not processed', async () => {
    const cwd = await create_temp_dir();
    const file_path = await write_markdown_fixture(cwd);
    const ingest_result = await ingest_markdown_workflow({ file_path, cwd });
    expect(ingest_result.ok).toBe(true);
    if (!ingest_result.ok) {
      return;
    }

    const result = await understand_source_workflow({
      cwd,
      source_id: ingest_result.data.source_id,
      understand: async () => ({
        summary: 'Summary',
        key_points: [],
        uncertainties: [],
        discussion_starters: [],
      }),
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe('INVALID_STATE');
  });

  it('marks Source failed when understanding artifacts are missing', async () => {
    const cwd = await create_temp_dir();
    const file_path = await write_markdown_fixture(cwd);
    const ingest_result = await ingest_markdown_workflow({
      file_path,
      cwd,
      now: new Date('2026-05-14T00:00:00.000Z'),
    });
    expect(ingest_result.ok).toBe(true);
    if (!ingest_result.ok) {
      return;
    }
    const process_result = await process_source_workflow({
      cwd,
      source_id: ingest_result.data.source_id,
      now: new Date('2026-05-14T01:00:00.000Z'),
    });
    expect(process_result.ok).toBe(true);
    await rm(
      path.join(
        cwd,
        'knowledge',
        'sources',
        '2026',
        '05',
        ingest_result.data.source_id,
        'processed',
        'segments.json',
      ),
    );

    const result = await understand_source_workflow({
      cwd,
      source_id: ingest_result.data.source_id,
      now: new Date('2026-05-14T02:00:00.000Z'),
      understand: async () => ({
        summary: 'Summary',
        key_points: [],
        uncertainties: [],
        discussion_starters: [],
      }),
    });
    const source = await get_source(ingest_result.data.source_id, { cwd });

    expect(result.ok).toBe(false);
    expect(source.status).toBe('failed');
    expect(source.last_error?.stage).toBe('understanding');
  });

  it('marks Source failed when understand agent fails', async () => {
    const cwd = await create_temp_dir();
    const file_path = await write_markdown_fixture(cwd);
    const ingest_result = await ingest_markdown_workflow({ file_path, cwd });
    expect(ingest_result.ok).toBe(true);
    if (!ingest_result.ok) {
      return;
    }
    const process_result = await process_source_workflow({
      cwd,
      source_id: ingest_result.data.source_id,
    });
    expect(process_result.ok).toBe(true);

    const result = await understand_source_workflow({
      cwd,
      source_id: ingest_result.data.source_id,
      understand: async () => {
        throw new Error('agent failed');
      },
    });
    const source = await get_source(ingest_result.data.source_id, { cwd });

    expect(result.ok).toBe(false);
    expect(source.status).toBe('failed');
    expect(source.last_error?.stage).toBe('understanding');
    expect(source.last_error?.message).toBe('agent failed');
  });

  it('starts discussion, appends messages, and updates summary', async () => {
    const cwd = await create_temp_dir();
    const source_id = await create_understanding_ready_source(cwd);

    const result = await discuss_source_workflow({
      cwd,
      source_id,
      user_message: 'This matters for agent design.',
      now: new Date('2026-05-14T03:00:00.000Z'),
      discuss: async ({ agent_input }) => ({
        assistant_message: `Reply to ${agent_input.user_message}`,
        discussion_summary_update: {
          confirmed_points: ['Agent design matters.'],
          open_questions: [],
          unresolved_issues: [],
          next_prompts: ['How should we apply it?'],
          ready_for_approval: false,
        },
      }),
    });
    const source = await get_source(source_id, { cwd });
    const messages = await read_discussion_messages(source_id, { cwd });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(source.status).toBe('discussing');
    expect(messages.map((message) => message.role)).toEqual([
      'user',
      'assistant',
    ]);
    expect(result.data.discussion_summary.summary_version).toBe(1);
    expect(result.data.discussion_summary.confirmed_points).toEqual([
      'Agent design matters.',
    ]);
  });

  it('continues discussion without resetting summary version', async () => {
    const cwd = await create_temp_dir();
    const source_id = await create_understanding_ready_source(cwd);
    const first = await discuss_source_workflow({
      cwd,
      source_id,
      user_message: 'First',
      discuss: async () => ({
        assistant_message: 'First reply',
        discussion_summary_update: {
          confirmed_points: ['First point'],
          open_questions: [],
          unresolved_issues: [],
          next_prompts: [],
          ready_for_approval: false,
        },
      }),
    });
    expect(first.ok).toBe(true);

    const second = await discuss_source_workflow({
      cwd,
      source_id,
      user_message: 'Second',
      discuss: async () => ({
        assistant_message: 'Second reply',
        discussion_summary_update: {
          confirmed_points: ['Second point'],
          open_questions: [],
          unresolved_issues: [],
          next_prompts: [],
          ready_for_approval: true,
        },
      }),
    });

    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }
    expect(second.data.discussion_summary.summary_version).toBe(2);
    expect(second.data.discussion_summary.discussion_status).toBe(
      'ready_for_approval',
    );
  });

  it('keeps Source discussing when discussion agent fails', async () => {
    const cwd = await create_temp_dir();
    const source_id = await create_understanding_ready_source(cwd);

    const result = await discuss_source_workflow({
      cwd,
      source_id,
      user_message: 'Fail this turn',
      discuss: async () => {
        throw new Error('agent failed');
      },
    });
    const source = await get_source(source_id, { cwd });
    const messages = await read_discussion_messages(source_id, { cwd });

    expect(result.ok).toBe(false);
    expect(source.status).toBe('discussing');
    expect(source.last_error?.stage).toBe('discussion');
    expect(messages.map((message) => message.role)).toEqual(['user']);
  });

  it('approves a ready discussion for note composition', async () => {
    const cwd = await create_temp_dir();
    const source_id = await create_understanding_ready_source(cwd);
    const discuss_result = await discuss_source_workflow({
      cwd,
      source_id,
      user_message: 'Ready',
      now: new Date('2026-05-14T03:00:00.000Z'),
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
    expect(discuss_result.ok).toBe(true);

    const result = await approve_source_workflow({
      cwd,
      source_id,
      now: new Date('2026-05-14T04:00:00.000Z'),
    });
    const source = await get_source(source_id, { cwd });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(source.status).toBe('approved_for_note');
    expect(source.discussion_summary.discussion_status).toBe('closed');
    expect(result.next_actions).toEqual([
      {
        label: 'Compose note',
        command: `ai-knowledge note compose ${source_id}`,
      },
    ]);
  });

  it('rejects approval when Source is not discussing', async () => {
    const cwd = await create_temp_dir();
    const source_id = await create_understanding_ready_source(cwd);

    const result = await approve_source_workflow({ cwd, source_id });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe('INVALID_STATE');
  });

  it('rejects approval when discussion is not ready', async () => {
    const cwd = await create_temp_dir();
    const source_id = await create_understanding_ready_source(cwd);
    await discuss_source_workflow({
      cwd,
      source_id,
      user_message: 'Not ready',
      discuss: async () => ({
        assistant_message: 'Not ready.',
        discussion_summary_update: {
          confirmed_points: ['Confirmed'],
          open_questions: ['Question'],
          unresolved_issues: [],
          next_prompts: [],
          ready_for_approval: false,
        },
      }),
    });

    const result = await approve_source_workflow({ cwd, source_id });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.message).toBe('Discussion is not ready for approval.');
  });

  it('rejects approval without confirmed points', async () => {
    const cwd = await create_temp_dir();
    const source_id = await create_understanding_ready_source(cwd);
    await discuss_source_workflow({
      cwd,
      source_id,
      user_message: 'Ready without points',
      discuss: async () => ({
        assistant_message: 'Ready but empty.',
        discussion_summary_update: {
          confirmed_points: [],
          open_questions: [],
          unresolved_issues: [],
          next_prompts: [],
          ready_for_approval: true,
        },
      }),
    });

    const result = await approve_source_workflow({ cwd, source_id });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.message).toBe(
      'Discussion must have confirmed_points before approval.',
    );
  });

  it('returns NOT_FOUND for missing Source show', async () => {
    const cwd = await create_temp_dir();

    const result = await show_source_workflow({
      cwd,
      source_id: 'src_20260514_upload_markdown_missing',
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe('NOT_FOUND');
  });
});

async function create_understanding_ready_source(cwd: string): Promise<string> {
  const file_path = await write_markdown_fixture(
    cwd,
    'input.md',
    '# Discuss Me\n\nBody.\n',
  );
  const ingest_result = await ingest_markdown_workflow({
    file_path,
    cwd,
    now: new Date('2026-05-14T00:00:00.000Z'),
  });
  if (!ingest_result.ok) {
    throw new Error(ingest_result.error.message);
  }
  const process_result = await process_source_workflow({
    cwd,
    source_id: ingest_result.data.source_id,
    now: new Date('2026-05-14T01:00:00.000Z'),
  });
  if (!process_result.ok) {
    throw new Error(process_result.error.message);
  }
  const understand_result = await understand_source_workflow({
    cwd,
    source_id: ingest_result.data.source_id,
    now: new Date('2026-05-14T02:00:00.000Z'),
    understand: async () => ({
      summary: 'Draft summary',
      key_points: ['Draft point'],
      uncertainties: [],
      discussion_starters: [],
    }),
  });
  if (!understand_result.ok) {
    throw new Error(understand_result.error.message);
  }
  return ingest_result.data.source_id;
}
