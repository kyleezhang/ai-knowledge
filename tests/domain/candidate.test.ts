import { describe, expect, it } from 'vitest';
import {
  CandidateSchema,
  CandidateSourceTypeSchema,
  CandidateStatusSchema,
  parse_candidate,
} from '../../src/domain/candidate.js';

const valid_candidate = {
  id: 'cand_20260506_github_trending_openmanus',
  source_type: 'github_trending',
  title: 'OpenManus',
  summary: 'A brief preview for recommendation list.',
  url: 'https://example.com/openmanus',
  author: 'owner_or_submitter',
  published_at: '2026-05-06T00:00:00Z',
  collected_at: '2026-05-06T08:30:00Z',
  scored_at: '2026-05-06T08:31:00Z',
  tags: ['agent', 'coding-agent'],
  status: 'recommended',
  score: {
    total: 10,
    breakdown: {
      relevance: 3,
      learning_value: 3,
      novelty: 2,
      discussability: 2,
    },
    reason:
      'High relevance to AI agent engineering and strong discussion value.',
  },
  external_ref: {
    platform: 'github',
    id: 'owner/repo',
    url: 'https://github.com/owner/repo',
    extra: {
      rank: 1,
    },
  },
  converted_source_id: null,
};

describe('Candidate domain', () => {
  it('parses a valid Candidate', () => {
    const candidate = parse_candidate(valid_candidate);

    expect(candidate.id).toBe('cand_20260506_github_trending_openmanus');
    expect(candidate.source_type).toBe('github_trending');
    expect(candidate.status).toBe('recommended');
    expect(candidate.score.total).toBe(10);
  });

  it('supports converted Candidates with a converted_source_id', () => {
    const candidate = parse_candidate({
      ...valid_candidate,
      status: 'converted',
      converted_source_id: 'src_20260506_github_trending_openmanus',
    });

    expect(candidate.status).toBe('converted');
    expect(candidate.converted_source_id).toBe(
      'src_20260506_github_trending_openmanus',
    );
  });

  it('rejects unsupported source_type and status values', () => {
    expect(() => CandidateSourceTypeSchema.parse('rss_feed')).toThrow();
    expect(() => CandidateStatusSchema.parse('approved')).toThrow();
    expect(() =>
      CandidateSchema.parse({ ...valid_candidate, source_type: 'rss_feed' }),
    ).toThrow();
    expect(() =>
      CandidateSchema.parse({ ...valid_candidate, status: 'approved' }),
    ).toThrow();
  });

  it('rejects score breakdown values outside 0-3', () => {
    expect(() =>
      CandidateSchema.parse({
        ...valid_candidate,
        score: {
          ...valid_candidate.score,
          breakdown: {
            ...valid_candidate.score.breakdown,
            relevance: 4,
          },
        },
      }),
    ).toThrow();

    expect(() =>
      CandidateSchema.parse({
        ...valid_candidate,
        score: {
          ...valid_candidate.score,
          breakdown: {
            ...valid_candidate.score.breakdown,
            novelty: -1,
          },
        },
      }),
    ).toThrow();
  });

  it('rejects score.total when it does not match breakdown sum', () => {
    expect(() =>
      parse_candidate({
        ...valid_candidate,
        score: {
          ...valid_candidate.score,
          total: 9,
        },
      }),
    ).toThrow('candidate score.total must equal score breakdown sum');
  });

  it('rejects converted Candidates without a source id', () => {
    expect(() =>
      parse_candidate({
        ...valid_candidate,
        status: 'converted',
        converted_source_id: null,
      }),
    ).toThrow('converted candidate must have converted_source_id');

    expect(() =>
      parse_candidate({
        ...valid_candidate,
        status: 'converted',
        converted_source_id: '   ',
      }),
    ).toThrow('converted candidate must have converted_source_id');
  });

  it('rejects non-converted Candidates with a source id', () => {
    expect(() =>
      parse_candidate({
        ...valid_candidate,
        converted_source_id: 'src_20260506_github_trending_openmanus',
      }),
    ).toThrow('non-converted candidate must have converted_source_id = null');
  });

  it('rejects camelCase core fields', () => {
    expect(() =>
      CandidateSchema.parse({
        ...valid_candidate,
        sourceType: 'github_trending',
      }),
    ).toThrow();

    expect(() =>
      CandidateSchema.parse({
        ...valid_candidate,
        convertedSourceId: null,
      }),
    ).toThrow();
  });
});
