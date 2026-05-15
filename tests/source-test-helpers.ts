import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Source } from '../src/domain/source.js';

export async function create_temp_dir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'ai-knowledge-'));
}

export async function write_markdown_fixture(
  cwd: string,
  name = 'input.md',
  content = '# Test Source\n\nBody text.\n',
): Promise<string> {
  const file_path = path.join(cwd, name);
  await writeFile(file_path, content, 'utf8');
  return file_path;
}

export function create_test_source(overrides: Partial<Source> = {}): Source {
  const base: Source = {
    id: 'src_20260514_upload_markdown_test-source',
    title: 'Test Source',
    status: 'ingested',
    ingest_type: 'upload_markdown',
    content_type: 'document',
    origin: {
      type: 'user_import',
      candidate_id: null,
      user_input_type: 'markdown',
    },
    origin_candidate_id: null,
    url: null,
    author: null,
    published_at: null,
    ingested_at: '2026-05-14T00:00:00.000Z',
    updated_at: '2026-05-14T00:00:00.000Z',
    processing_artifacts: {},
    draft_understanding: null,
    discussion_summary: {
      discussion_status: 'open',
      summary_version: 0,
      confirmed_points: [],
      open_questions: [],
      unresolved_issues: [],
      next_prompts: [],
      ready_for_approval: false,
      last_updated_at: '2026-05-14T00:00:00.000Z',
    },
    note_ids: [],
  };

  return {
    ...base,
    ...overrides,
    origin: {
      ...base.origin,
      ...overrides.origin,
    },
    discussion_summary: {
      ...base.discussion_summary,
      ...overrides.discussion_summary,
    },
  };
}
