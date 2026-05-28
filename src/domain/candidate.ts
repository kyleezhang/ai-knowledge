import { z } from 'zod';

const ScoreValueSchema = z.number().int().min(0).max(3);

export const CandidateSourceTypeSchema = z.enum([
  'github_trending',
  'hacker_news',
]);

export const CandidateStatusSchema = z.enum([
  'new',
  'recommended',
  'dismissed',
  'selected',
  'converted',
]);

export const CandidateScoreBreakdownSchema = z
  .object({
    relevance: ScoreValueSchema,
    learning_value: ScoreValueSchema,
    novelty: ScoreValueSchema,
    discussability: ScoreValueSchema,
  })
  .strict();

export const CandidateScoreSchema = z
  .object({
    total: z.number().int().nonnegative(),
    breakdown: CandidateScoreBreakdownSchema,
    reason: z.string(),
  })
  .strict();

export const CandidateExternalRefSchema = z
  .object({
    platform: z.string(),
    id: z.string(),
    url: z.string(),
    extra: z.record(z.string(), z.unknown()),
  })
  .strict();

export const CandidateSchema = z
  .object({
    id: z.string(),
    source_type: CandidateSourceTypeSchema,
    title: z.string(),
    summary: z.string(),
    url: z.string(),
    author: z.string().nullable(),
    published_at: z.string().nullable(),
    collected_at: z.string(),
    scored_at: z.string().nullable(),
    tags: z.array(z.string()),
    status: CandidateStatusSchema,
    score: CandidateScoreSchema,
    external_ref: CandidateExternalRefSchema,
    converted_source_id: z.string().nullable(),
  })
  .strict();

export type Candidate = z.infer<typeof CandidateSchema>;
export type CandidateStatus = z.infer<typeof CandidateStatusSchema>;
export type CandidateSourceType = z.infer<typeof CandidateSourceTypeSchema>;

export function validate_candidate_invariants(candidate: Candidate): void {
  const breakdown = candidate.score.breakdown;
  const total =
    breakdown.relevance +
    breakdown.learning_value +
    breakdown.novelty +
    breakdown.discussability;

  if (candidate.score.total !== total) {
    throw new Error('candidate score.total must equal score breakdown sum');
  }

  if (candidate.status === 'converted') {
    if (candidate.converted_source_id === null) {
      throw new Error('converted candidate must have converted_source_id');
    }
    if (candidate.converted_source_id.trim().length === 0) {
      throw new Error('converted candidate must have converted_source_id');
    }
    return;
  }

  if (candidate.converted_source_id !== null) {
    throw new Error(
      'non-converted candidate must have converted_source_id = null',
    );
  }
}

export function parse_candidate(value: unknown): Candidate {
  const candidate = CandidateSchema.parse(value);
  validate_candidate_invariants(candidate);
  return candidate;
}
