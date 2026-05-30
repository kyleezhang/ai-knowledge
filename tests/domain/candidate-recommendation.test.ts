import { describe, expect, it } from 'vitest';
import {
  candidate_canonical_keys,
  detect_duplicate_candidate,
  score_candidate,
} from '../../src/domain/candidate-recommendation.js';
import { create_test_candidate } from '../candidate-test-helpers.js';

describe('Candidate recommendation domain', () => {
  it('builds canonical keys from url, external_ref, and title slug', () => {
    const keys = candidate_canonical_keys(
      create_test_candidate({
        title: 'AI Agent Toolkit',
        url: 'https://Example.com/path/?utm_source=x#section',
        external_ref: {
          platform: 'github',
          id: 'owner/repo',
          url: 'https://github.com/owner/repo',
          extra: {},
        },
      }),
    );

    expect(keys).toEqual({
      canonical_url: 'https://example.com/path',
      external_ref: 'github:owner/repo',
      title_slug: 'ai-agent-toolkit',
    });
  });

  it('detects duplicates by canonical URL, external_ref, and title slug', () => {
    const existing = [
      create_test_candidate({
        id: 'cand_20260514_github_trending_existing',
        title: 'Existing AI Agent',
        url: 'https://example.com/repo',
        external_ref: {
          platform: 'github',
          id: 'owner/repo',
          url: 'https://github.com/owner/repo',
          extra: {},
        },
      }),
    ];

    expect(
      detect_duplicate_candidate(
        create_test_candidate({ url: 'https://example.com/repo?ref=hn' }),
        existing,
      ),
    ).toMatchObject({ duplicate: true, reason: 'canonical_url' });
    expect(
      detect_duplicate_candidate(
        create_test_candidate({
          url: 'https://example.com/other',
          external_ref: {
            platform: 'github',
            id: 'owner/repo',
            url: 'https://github.com/owner/repo',
            extra: {},
          },
        }),
        existing,
      ),
    ).toMatchObject({ duplicate: true, reason: 'external_ref' });
    expect(
      detect_duplicate_candidate(
        create_test_candidate({
          title: 'Existing AI Agent',
          url: 'https://example.com/different',
          external_ref: {
            platform: 'github',
            id: 'owner/different',
            url: 'https://github.com/owner/different',
            extra: {},
          },
        }),
        existing,
      ),
    ).toMatchObject({ duplicate: true, reason: 'title_slug' });
  });

  it('dismisses low-information and unrelated Candidates with reasons', () => {
    const short = score_candidate(
      create_test_candidate({ title: 'AI', summary: 'Too short' }),
      { scored_at: '2026-05-27T00:00:00.000Z' },
    );
    const unrelated = score_candidate(
      create_test_candidate({
        title: 'Gardening weekly',
        summary: 'A long enough article about flowers and soil care.',
        tags: ['gardening'],
      }),
      { scored_at: '2026-05-27T00:00:00.000Z' },
    );

    expect(short.status).toBe('dismissed');
    expect(short.score.reason).toContain('title is too short');
    expect(unrelated.status).toBe('dismissed');
    expect(unrelated.score.reason).toContain('not clearly related to AI');
  });

  it('scores and recommends Candidates that reach the threshold', () => {
    const scored = score_candidate(
      create_test_candidate({
        title: 'New AI Agent Research Toolkit',
        summary:
          'A new research toolkit for AI agents with practical tradeoff examples and implementation details.',
        tags: ['ai', 'agent'],
      }),
      { scored_at: '2026-05-27T00:00:00.000Z' },
    );

    expect(scored.status).toBe('recommended');
    expect(scored.scored_at).toBe('2026-05-27T00:00:00.000Z');
    expect(scored.score.total).toBe(
      scored.score.breakdown.relevance +
        scored.score.breakdown.learning_value +
        scored.score.breakdown.novelty +
        scored.score.breakdown.discussability,
    );
    expect(scored.score.reason).toContain('Recommended');
  });

  it('dismisses Candidates below the threshold', () => {
    const scored = score_candidate(
      create_test_candidate({
        title: 'AI link',
        summary: 'AI note with limited context for discussion.',
        tags: ['ai'],
      }),
      { scored_at: '2026-05-27T00:00:00.000Z', threshold: 12 },
    );

    expect(scored.status).toBe('dismissed');
    expect(scored.score.reason).toContain('below threshold');
  });
});
