import { z } from 'zod';

export const RelatedNoteCandidateStatusSchema = z.enum([
  'pending',
  'confirmed',
  'rejected',
]);

export const RelatedNoteCandidateSchema = z.object({
  note_id: z.string().min(1),
  title: z.string().min(1),
  reason: z.string().min(1),
  status: RelatedNoteCandidateStatusSchema,
});

export const RelatedNoteConfirmationInputSchema = z.object({
  confirmed_note_ids: z.array(z.string().min(1)),
  rejected_note_ids: z.array(z.string().min(1)),
});

export type RelatedNoteCandidate = z.infer<typeof RelatedNoteCandidateSchema>;
export type RelatedNoteCandidateStatus = z.infer<
  typeof RelatedNoteCandidateStatusSchema
>;
export type RelatedNoteConfirmationInput = z.infer<
  typeof RelatedNoteConfirmationInputSchema
>;

export function parse_related_note_candidate(
  value: unknown,
): RelatedNoteCandidate {
  return RelatedNoteCandidateSchema.parse(value);
}

export function apply_related_note_confirmation(input: {
  candidates: RelatedNoteCandidate[];
  confirmed_note_ids: string[];
  rejected_note_ids: string[];
}): RelatedNoteCandidate[] {
  const confirmation = RelatedNoteConfirmationInputSchema.parse({
    confirmed_note_ids: input.confirmed_note_ids,
    rejected_note_ids: input.rejected_note_ids,
  });
  const confirmed = new Set(confirmation.confirmed_note_ids);
  const rejected = new Set(confirmation.rejected_note_ids);

  for (const note_id of confirmed) {
    if (rejected.has(note_id)) {
      throw new Error(
        `related note cannot be both confirmed and rejected: ${note_id}`,
      );
    }
  }

  const candidate_ids = new Set(
    input.candidates.map((candidate) => candidate.note_id),
  );
  for (const note_id of [...confirmed, ...rejected]) {
    if (!candidate_ids.has(note_id)) {
      throw new Error(
        `related note confirmation references unknown candidate: ${note_id}`,
      );
    }
  }

  return input.candidates.map((candidate) => {
    if (confirmed.has(candidate.note_id)) {
      return { ...candidate, status: 'confirmed' };
    }
    if (rejected.has(candidate.note_id)) {
      return { ...candidate, status: 'rejected' };
    }
    return { ...candidate, status: 'pending' };
  });
}

export function confirmed_related_note_ids(
  candidates: RelatedNoteCandidate[],
): string[] {
  return candidates
    .filter((candidate) => candidate.status === 'confirmed')
    .map((candidate) => candidate.note_id);
}
