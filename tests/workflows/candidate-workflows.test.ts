import { readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { create_candidate } from '../../src/storage/candidate-repo.js';
import { list_candidates_workflow } from '../../src/workflows/list-candidates-workflow.js';
import { show_candidate_workflow } from '../../src/workflows/show-candidate-workflow.js';
import { create_test_candidate } from '../candidate-test-helpers.js';
import { create_temp_dir } from '../source-test-helpers.js';

describe('candidate workflows', () => {
  it('lists Candidate summaries ordered by collected_at and filters by status', async () => {
    const cwd = await create_temp_dir();
    const older = create_test_candidate({
      id: 'cand_20260513_github_trending_older',
      title: 'Older',
      collected_at: '2026-05-13T01:00:00.000Z',
      status: 'dismissed',
    });
    const newer = create_test_candidate({
      id: 'cand_20260514_github_trending_newer',
      title: 'Newer',
      collected_at: '2026-05-14T01:00:00.000Z',
      status: 'recommended',
    });
    await create_candidate(older, { cwd });
    await create_candidate(newer, { cwd });

    const all = await list_candidates_workflow({ cwd });
    const recommended = await list_candidates_workflow({
      cwd,
      status: 'recommended',
    });

    expect(all.ok).toBe(true);
    expect(recommended.ok).toBe(true);
    if (!all.ok || !recommended.ok) return;
    expect(all.data.candidates.map((candidate) => candidate.id)).toEqual([
      newer.id,
      older.id,
    ]);
    expect(
      recommended.data.candidates.map((candidate) => candidate.id),
    ).toEqual([newer.id]);
  });

  it('shows Candidate summary and returns not found for missing Candidate', async () => {
    const cwd = await create_temp_dir();
    const candidate = create_test_candidate();
    await create_candidate(candidate, { cwd });

    const show = await show_candidate_workflow({
      cwd,
      candidate_id: candidate.id,
    });
    const missing = await show_candidate_workflow({
      cwd,
      candidate_id: 'cand_20260514_github_trending_missing',
    });

    expect(show.ok).toBe(true);
    if (show.ok) {
      expect(show.data.candidate).toMatchObject({
        id: candidate.id,
        title: candidate.title,
        status: candidate.status,
        score: candidate.score,
      });
    }
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('NOT_FOUND');
  });

  it('keeps list and show workflows read-only', async () => {
    const cwd = await create_temp_dir();
    const candidate = create_test_candidate();
    await create_candidate(candidate, { cwd });

    await list_candidates_workflow({ cwd });
    await show_candidate_workflow({ cwd, candidate_id: candidate.id });

    await expect(readdir(`${cwd}/knowledge/sources`)).rejects.toThrow();
    await expect(readdir(`${cwd}/knowledge/notes`)).rejects.toThrow();
    await expect(readdir(`${cwd}/knowledge/index`)).rejects.toThrow();
  });
});
