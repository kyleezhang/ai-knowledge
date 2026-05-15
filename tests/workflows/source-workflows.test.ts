import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ingest_markdown_workflow } from '../../src/workflows/ingest-markdown-workflow.js';
import { list_sources_workflow } from '../../src/workflows/list-sources-workflow.js';
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
