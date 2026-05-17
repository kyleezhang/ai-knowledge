import { z } from 'zod';

export const DraftUnderstandingCandidateSchema = z.object({
  summary: z.string(),
  key_points: z.array(z.string()),
  uncertainties: z.array(z.string()),
  discussion_starters: z.array(z.string()),
});

export type DraftUnderstandingCandidate = z.infer<
  typeof DraftUnderstandingCandidateSchema
>;
