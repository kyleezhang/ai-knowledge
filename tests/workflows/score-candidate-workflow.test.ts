import { readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  create_candidate,
  get_candidate,
} from '../../src/storage/candidate-repo.js';
import { score_candidate_workflow } from '../../src/workflows/score-candidate-workflow.js';
import { create_test_candidate } from '../candidate-test-helpers.js';
import { create_temp_dir } from '../source-test-helpers.js';

describe('score candidate workflow', () => {
  it('rescoring updates score, status, and scored_at only on Candidate', async () => {
    const cwd = await create_temp_dir();
    const candidate = create_test_candidate({
      title: 'New AI Agent Research Toolkit',
      summary:
        'A new research toolkit for AI agents with practical tradeoff examples and implementation details.',
      tags: ['ai', 'agent'],
      status: 'new',
      scored_at: null,
      score: {
        total: 0,
        breakdown: {
          relevance: 0,
          learning_value: 0,
          novelty: 0,
          discussability: 0,
        },
        reason: 'Not scored yet.',
      },
    });
    await create_candidate(candidate, { cwd });

    const result = await score_candidate_workflow({
      cwd,
      candidate_id: candidate.id,
      now: new Date('2026-05-27T00:00:00.000Z'),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.candidate.status).toBe('recommended');
    expect(result.data.candidate.score.total).toBeGreaterThanOrEqual(8);
    await expect(get_candidate(candidate.id, { cwd })).resolves.toMatchObject({
      scored_at: '2026-05-27T00:00:00.000Z',
      status: 'recommended',
    });
    await expect(readdir(`${cwd}/knowledge/sources`)).rejects.toThrow();
    await expect(readdir(`${cwd}/knowledge/notes`)).rejects.toThrow();
    await expect(readdir(`${cwd}/knowledge/index`)).rejects.toThrow();
  });

  it('returns not found for missing Candidate', async () => {
    const cwd = await create_temp_dir();

    const result = await score_candidate_workflow({
      cwd,
      candidate_id: 'cand_20260527_github_trending_missing',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND');
  });
});
