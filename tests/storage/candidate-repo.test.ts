import { readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  create_candidate,
  get_candidate,
  list_candidates,
  update_candidate,
} from '../../src/storage/candidate-repo.js';
import { candidate_json_path } from '../../src/storage/paths.js';
import { create_test_candidate } from '../candidate-test-helpers.js';
import { create_temp_dir } from '../source-test-helpers.js';

describe('candidate repo', () => {
  it('saves and reads Candidate JSON through schema validation', async () => {
    const cwd = await create_temp_dir();
    const candidate = create_test_candidate();

    await create_candidate(candidate, { cwd });

    expect(candidate_json_path(candidate.id, { cwd })).toContain(
      'knowledge/candidates/2026/05/cand_20260514_github_trending_test-candidate.json',
    );
    await expect(get_candidate(candidate.id, { cwd })).resolves.toEqual(
      candidate,
    );
  });

  it('rejects duplicate, invalid, and missing Candidates', async () => {
    const cwd = await create_temp_dir();
    const candidate = create_test_candidate();
    await create_candidate(candidate, { cwd });

    await expect(create_candidate(candidate, { cwd })).rejects.toThrow(
      'Candidate already exists',
    );
    await expect(
      create_candidate(
        create_test_candidate({
          id: 'invalid-candidate-id',
        }),
        { cwd },
      ),
    ).rejects.toThrow('Invalid candidate id');
    await expect(
      get_candidate('cand_20260514_github_trending_missing', { cwd }),
    ).rejects.toThrow('Candidate not found');
  });

  it('lists Candidates by collected_at desc and filters by status', async () => {
    const cwd = await create_temp_dir();
    const older = create_test_candidate({
      id: 'cand_20260513_github_trending_older',
      title: 'Older',
      collected_at: '2026-05-13T01:00:00.000Z',
      status: 'dismissed',
    });
    const newer = create_test_candidate({
      id: 'cand_20260514_hacker_news_newer',
      source_type: 'hacker_news',
      title: 'Newer',
      collected_at: '2026-05-14T01:00:00.000Z',
      status: 'recommended',
    });
    await create_candidate(older, { cwd });
    await create_candidate(newer, { cwd });

    await expect(list_candidates({}, { cwd })).resolves.toEqual([newer, older]);
    await expect(
      list_candidates({ status: 'recommended' }, { cwd }),
    ).resolves.toEqual([newer]);
  });

  it('updates existing Candidate JSON through schema validation', async () => {
    const cwd = await create_temp_dir();
    const candidate = create_test_candidate();
    await create_candidate(candidate, { cwd });

    const updated = await update_candidate(
      {
        ...candidate,
        status: 'recommended',
        scored_at: '2026-05-27T00:00:00.000Z',
      },
      { cwd },
    );

    expect(updated.status).toBe('recommended');
    await expect(get_candidate(candidate.id, { cwd })).resolves.toMatchObject({
      status: 'recommended',
      scored_at: '2026-05-27T00:00:00.000Z',
    });
  });

  it('rejects updates for missing Candidates', async () => {
    const cwd = await create_temp_dir();

    await expect(
      update_candidate(create_test_candidate(), { cwd }),
    ).rejects.toThrow('Candidate not found');
  });

  it('does not create index entries when Candidates are saved or updated', async () => {
    const cwd = await create_temp_dir();
    const candidate = create_test_candidate();
    await create_candidate(candidate, { cwd });
    await update_candidate({ ...candidate, status: 'dismissed' }, { cwd });

    await expect(readdir(`${cwd}/knowledge/index`)).rejects.toThrow();
  });
});
