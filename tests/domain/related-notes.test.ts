import { describe, expect, it } from 'vitest';
import {
  apply_related_note_confirmation,
  confirmed_related_note_ids,
  parse_related_note_candidate,
  type RelatedNoteCandidate,
} from '../../src/domain/related-notes.js';

const candidate: RelatedNoteCandidate = {
  note_id: 'note_20260514_related',
  title: 'Related Note',
  reason: 'Shares confirmed conclusion keywords: agent, memory',
  status: 'pending',
};

describe('related notes domain', () => {
  it('accepts a valid related note candidate', () => {
    expect(parse_related_note_candidate(candidate)).toEqual(candidate);
  });

  it('rejects empty note id or reason', () => {
    expect(() =>
      parse_related_note_candidate({ ...candidate, note_id: '' }),
    ).toThrow();
    expect(() =>
      parse_related_note_candidate({ ...candidate, reason: '' }),
    ).toThrow();
  });

  it('applies confirmed and rejected statuses', () => {
    const second = {
      ...candidate,
      note_id: 'note_20260514_other',
      title: 'Other Note',
    };

    const result = apply_related_note_confirmation({
      candidates: [candidate, second],
      confirmed_note_ids: [candidate.note_id],
      rejected_note_ids: [second.note_id],
    });

    expect(result.map((item) => [item.note_id, item.status])).toEqual([
      [candidate.note_id, 'confirmed'],
      [second.note_id, 'rejected'],
    ]);
    expect(confirmed_related_note_ids(result)).toEqual([candidate.note_id]);
  });

  it('rejects contradictory confirmation input', () => {
    expect(() =>
      apply_related_note_confirmation({
        candidates: [candidate],
        confirmed_note_ids: [candidate.note_id],
        rejected_note_ids: [candidate.note_id],
      }),
    ).toThrow('related note cannot be both confirmed and rejected');
  });

  it('rejects confirmation for unknown candidates', () => {
    expect(() =>
      apply_related_note_confirmation({
        candidates: [candidate],
        confirmed_note_ids: ['note_20260514_missing'],
        rejected_note_ids: [],
      }),
    ).toThrow('related note confirmation references unknown candidate');
  });
});
