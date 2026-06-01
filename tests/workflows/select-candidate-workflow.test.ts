import { access, readFile, readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  create_candidate,
  get_candidate,
} from '../../src/storage/candidate-repo.js';
import {
  source_dir,
  source_processed_dir,
  source_raw_markdown_path,
} from '../../src/storage/paths.js';
import { get_source } from '../../src/storage/source-repo.js';
import { process_source_workflow } from '../../src/workflows/process-source-workflow.js';
import { select_candidate_workflow } from '../../src/workflows/select-candidate-workflow.js';
import { create_test_candidate } from '../candidate-test-helpers.js';
import { create_temp_dir } from '../source-test-helpers.js';

describe('select candidate workflow', () => {
  it('converts a recommended Candidate to an ingested Source with bidirectional links', async () => {
    const cwd = await create_temp_dir();
    const candidate = create_test_candidate({
      id: 'cand_20260527_github_trending_ai-agent',
      title: 'AI Agent',
      status: 'recommended',
    });
    await create_candidate(candidate, { cwd });

    const result = await select_candidate_workflow({
      cwd,
      candidate_id: candidate.id,
      now: new Date('2026-05-27T10:00:00.000Z'),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.source_id).toBe(
      'src_20260527_candidate_selected_ai-agent',
    );
    expect(result.data.source).toMatchObject({
      status: 'ingested',
      ingest_type: 'candidate_selected',
      content_type: 'link',
      processing_artifacts: {},
      draft_understanding_summary: null,
      note_ids: [],
    });
    await expect(get_candidate(candidate.id, { cwd })).resolves.toMatchObject({
      status: 'converted',
      converted_source_id: result.data.source_id,
    });
    await expect(
      get_source(result.data.source_id, { cwd }),
    ).resolves.toMatchObject({
      ingest_type: 'candidate_selected',
      origin: { type: 'candidate', candidate_id: candidate.id },
      origin_candidate_id: candidate.id,
    });
    await expect(
      readFile(
        source_raw_markdown_path(result.data.source_id, { cwd }),
        'utf8',
      ),
    ).resolves.toContain(
      'candidate_id: cand_20260527_github_trending_ai-agent',
    );
    await expect(
      access(source_processed_dir(result.data.source_id, { cwd })),
    ).resolves.toBeUndefined();
    await expect(readdir(`${cwd}/knowledge/notes`)).rejects.toThrow();
    await expect(readdir(`${cwd}/knowledge/index`)).rejects.toThrow();
    expect(result.next_actions).toEqual([
      {
        label: 'Process source',
        command: `ai-knowledge source process ${result.data.source_id}`,
      },
    ]);

    const process = await process_source_workflow({
      cwd,
      source_id: result.data.source_id,
      now: new Date('2026-05-27T11:00:00.000Z'),
    });
    expect(process.ok).toBe(true);
    if (!process.ok) throw new Error(process.error.message);
    expect(process.data.source.processing_artifacts).toEqual({
      clean_text: 'processed/clean_text.md',
      segments: 'processed/segments.json',
      metadata: 'processed/metadata.json',
    });
  });

  it('rejects missing, non-recommended, and already converted Candidates', async () => {
    const cwd = await create_temp_dir();
    await create_candidate(
      create_test_candidate({
        id: 'cand_20260527_github_trending_new',
        status: 'new',
      }),
      { cwd },
    );
    await create_candidate(
      create_test_candidate({
        id: 'cand_20260527_github_trending_converted',
        status: 'converted',
        converted_source_id: 'src_20260527_candidate_selected_existing',
      }),
      { cwd },
    );

    const missing = await select_candidate_workflow({
      cwd,
      candidate_id: 'cand_20260527_github_trending_missing',
    });
    const non_recommended = await select_candidate_workflow({
      cwd,
      candidate_id: 'cand_20260527_github_trending_new',
    });
    const converted = await select_candidate_workflow({
      cwd,
      candidate_id: 'cand_20260527_github_trending_converted',
    });

    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('NOT_FOUND');
    expect(non_recommended.ok).toBe(false);
    if (!non_recommended.ok)
      expect(non_recommended.error.code).toBe('INVALID_STATE');
    expect(converted.ok).toBe(false);
    if (!converted.ok) expect(converted.error.code).toBe('INVALID_STATE');
  });

  it('prevents repeat conversion after successful select', async () => {
    const cwd = await create_temp_dir();
    const candidate = create_test_candidate({
      id: 'cand_20260527_github_trending_repeat',
      title: 'Repeat Candidate',
      status: 'recommended',
    });
    await create_candidate(candidate, { cwd });

    const first = await select_candidate_workflow({
      cwd,
      candidate_id: candidate.id,
    });
    const second = await select_candidate_workflow({
      cwd,
      candidate_id: candidate.id,
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe('INVALID_STATE');
    if (!first.ok) return;
    const source_root_entries = await readdir(
      source_dir(first.data.source_id, { cwd }),
    );
    expect(source_root_entries).toContain('source.json');
  });
});
