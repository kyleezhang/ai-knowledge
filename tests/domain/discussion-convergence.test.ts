import { describe, expect, it } from 'vitest';
import { check_discussion_convergence } from '../../src/domain/discussion-convergence.js';
import { create_test_source } from '../source-test-helpers.js';

function create_discussing_source(
  overrides: Parameters<typeof create_test_source>[0] = {},
) {
  return create_test_source({
    status: 'discussing',
    processing_artifacts: {
      clean_text: 'processed/clean_text.md',
      segments: 'processed/segments.json',
      metadata: 'processed/metadata.json',
    },
    draft_understanding: {
      summary: 'Summary',
      key_points: ['Point'],
      uncertainties: [],
      discussion_starters: [],
      generated_at: '2026-05-14T00:00:00.000Z',
    },
    discussion_summary: {
      ...create_test_source().discussion_summary,
      confirmed_points: ['Confirmed'],
      open_questions: [],
      unresolved_issues: [],
      ready_for_approval: true,
    },
    ...overrides,
  });
}

describe('discussion convergence checker', () => {
  it('passes a ready discussing Source', () => {
    const result = check_discussion_convergence(create_discussing_source());

    expect(result).toEqual({ passed: true, reasons: [] });
  });

  it('rejects a non-discussing Source', () => {
    const result = check_discussion_convergence(
      create_discussing_source({ status: 'understanding_ready' }),
    );

    expect(result).toEqual({
      passed: false,
      reasons: ['source_not_discussing'],
    });
  });

  it('rejects a summary that is not marked ready', () => {
    const result = check_discussion_convergence(
      create_discussing_source({
        discussion_summary: {
          ...create_test_source().discussion_summary,
          confirmed_points: ['Confirmed'],
          ready_for_approval: false,
        },
      }),
    );

    expect(result).toEqual({
      passed: false,
      reasons: ['ready_for_approval_false'],
    });
  });

  it('rejects missing confirmed points', () => {
    const result = check_discussion_convergence(
      create_discussing_source({
        discussion_summary: {
          ...create_test_source().discussion_summary,
          confirmed_points: [],
          ready_for_approval: true,
        },
      }),
    );

    expect(result).toEqual({
      passed: false,
      reasons: ['missing_confirmed_points'],
    });
  });

  it('rejects open questions and unresolved issues', () => {
    const result = check_discussion_convergence(
      create_discussing_source({
        discussion_summary: {
          ...create_test_source().discussion_summary,
          confirmed_points: ['Confirmed'],
          open_questions: ['Question'],
          unresolved_issues: ['Issue'],
          ready_for_approval: true,
        },
      }),
    );

    expect(result).toEqual({
      passed: false,
      reasons: ['open_questions_present', 'unresolved_issues_present'],
    });
  });
});
