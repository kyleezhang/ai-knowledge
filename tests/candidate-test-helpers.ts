import type { Candidate } from '../src/domain/candidate.js';

export function create_test_candidate(
  overrides: Partial<Candidate> = {},
): Candidate {
  const base: Candidate = {
    id: 'cand_20260514_github_trending_test-candidate',
    source_type: 'github_trending',
    title: 'Test Candidate',
    summary: 'A candidate for testing.',
    url: 'https://example.com/test-candidate',
    author: 'owner',
    published_at: '2026-05-14T00:00:00.000Z',
    collected_at: '2026-05-14T01:00:00.000Z',
    scored_at: '2026-05-14T01:10:00.000Z',
    tags: ['agent', 'test'],
    status: 'recommended',
    score: {
      total: 10,
      breakdown: {
        relevance: 3,
        learning_value: 3,
        novelty: 2,
        discussability: 2,
      },
      reason: 'Good candidate for testing.',
    },
    external_ref: {
      platform: 'github',
      id: 'owner/repo',
      url: 'https://github.com/owner/repo',
      extra: { rank: 1 },
    },
    converted_source_id: null,
  };

  return {
    ...base,
    ...overrides,
    score: {
      ...base.score,
      ...overrides.score,
      breakdown: {
        ...base.score.breakdown,
        ...overrides.score?.breakdown,
      },
    },
    external_ref: {
      ...base.external_ref,
      ...overrides.external_ref,
      extra: {
        ...base.external_ref.extra,
        ...overrides.external_ref?.extra,
      },
    },
  };
}
