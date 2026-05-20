import { describe, expect, it } from 'vitest';
import { DraftUnderstandingSchema } from '../../src/domain/source.js';
import {
  DiscussionAgentOutputSchema,
  DiscussionMessageSchema,
  DiscussionSummaryUpdateSchema,
  DraftUnderstandingCandidateSchema,
  GroundedAnswerSchema,
} from '../../src/agents/schemas.js';

describe('agent schemas', () => {
  it('accepts draft understanding candidates without generated_at', () => {
    const candidate = DraftUnderstandingCandidateSchema.parse({
      summary: 'Summary',
      key_points: ['Point'],
      uncertainties: ['Unclear'],
      discussion_starters: ['Question?'],
    });

    expect(candidate).toEqual({
      summary: 'Summary',
      key_points: ['Point'],
      uncertainties: ['Unclear'],
      discussion_starters: ['Question?'],
    });
  });

  it('rejects draft understanding candidates with invalid field types', () => {
    expect(() =>
      DraftUnderstandingCandidateSchema.parse({
        summary: 'Summary',
        key_points: 'Point',
        uncertainties: [],
        discussion_starters: [],
      }),
    ).toThrow();
  });

  it('requires generated_at on persisted draft understanding', () => {
    expect(() =>
      DraftUnderstandingSchema.parse({
        summary: 'Summary',
        key_points: ['Point'],
        uncertainties: ['Unclear'],
        discussion_starters: ['Question?'],
      }),
    ).toThrow();

    expect(
      DraftUnderstandingSchema.parse({
        summary: 'Summary',
        key_points: ['Point'],
        uncertainties: ['Unclear'],
        discussion_starters: ['Question?'],
        generated_at: '2026-05-14T00:00:00.000Z',
      }),
    ).toEqual({
      summary: 'Summary',
      key_points: ['Point'],
      uncertainties: ['Unclear'],
      discussion_starters: ['Question?'],
      generated_at: '2026-05-14T00:00:00.000Z',
    });
  });

  it('accepts valid discussion messages', () => {
    expect(
      DiscussionMessageSchema.parse({
        role: 'user',
        content: 'Hello',
        created_at: '2026-05-14T00:00:00.000Z',
      }),
    ).toEqual({
      role: 'user',
      content: 'Hello',
      created_at: '2026-05-14T00:00:00.000Z',
    });
  });

  it('rejects invalid discussion message roles', () => {
    expect(() =>
      DiscussionMessageSchema.parse({
        role: 'system',
        content: 'Hello',
        created_at: '2026-05-14T00:00:00.000Z',
      }),
    ).toThrow();
  });

  it('accepts discussion agent output candidates', () => {
    expect(
      DiscussionAgentOutputSchema.parse({
        assistant_message: 'Reply',
        discussion_summary_update: {
          confirmed_points: ['Confirmed'],
          open_questions: [],
          unresolved_issues: [],
          next_prompts: ['Next?'],
          ready_for_approval: false,
        },
      }),
    ).toEqual({
      assistant_message: 'Reply',
      discussion_summary_update: {
        confirmed_points: ['Confirmed'],
        open_questions: [],
        unresolved_issues: [],
        next_prompts: ['Next?'],
        ready_for_approval: false,
      },
    });
  });

  it('rejects invalid discussion summary updates', () => {
    expect(() =>
      DiscussionSummaryUpdateSchema.parse({
        confirmed_points: 'Confirmed',
        open_questions: [],
        unresolved_issues: [],
        next_prompts: [],
        ready_for_approval: false,
      }),
    ).toThrow();
  });

  it('accepts grounded answers with cited approved notes', () => {
    expect(
      GroundedAnswerSchema.parse({
        conclusion: 'Conclusion',
        cited_notes: [
          {
            note_id: 'note_20260519_test',
            title: 'Test',
            relevant_points: ['Point'],
          },
        ],
        unconfirmed_materials: [],
        limitations: ['Only one note matched.'],
      }),
    ).toEqual({
      conclusion: 'Conclusion',
      cited_notes: [
        {
          note_id: 'note_20260519_test',
          title: 'Test',
          relevant_points: ['Point'],
        },
      ],
      unconfirmed_materials: [],
      limitations: ['Only one note matched.'],
    });
  });

  it('rejects grounded answers with malformed cited notes', () => {
    expect(() =>
      GroundedAnswerSchema.parse({
        conclusion: 'Conclusion',
        cited_notes: [{ note_id: 'note_1', title: 'Test' }],
        unconfirmed_materials: [],
        limitations: [],
      }),
    ).toThrow();
  });
});
