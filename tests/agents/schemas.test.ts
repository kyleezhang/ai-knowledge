import { describe, expect, it } from 'vitest';
import { DraftUnderstandingSchema } from '../../src/domain/source.js';
import { DraftUnderstandingCandidateSchema } from '../../src/agents/schemas.js';

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
});
