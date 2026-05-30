import { score_candidate } from '../domain/candidate-recommendation.js';
import type { StorageConfig } from '../storage/config.js';
import { StorageError } from '../storage/errors.js';
import { get_candidate, update_candidate } from '../storage/candidate-repo.js';
import {
  summarize_candidate,
  type CandidateSummary,
} from './candidate-summary.js';
import type { WorkflowResult } from './types.js';

export type ScoreCandidateWorkflowInput = {
  candidate_id: string;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
  now?: Date;
};

export type ScoreCandidateWorkflowData = {
  candidate: CandidateSummary;
};

export async function score_candidate_workflow(
  input: ScoreCandidateWorkflowInput,
): Promise<WorkflowResult<ScoreCandidateWorkflowData>> {
  try {
    const candidate = await get_candidate(input.candidate_id, {
      config: input.storage_config,
      cwd: input.cwd,
    });
    const scored = score_candidate(candidate, {
      scored_at: (input.now ?? new Date()).toISOString(),
    });
    const updated = await update_candidate(scored, {
      config: input.storage_config,
      cwd: input.cwd,
    });
    return { ok: true, data: { candidate: summarize_candidate(updated) } };
  } catch (error) {
    if (error instanceof StorageError && error.code === 'NOT_FOUND') {
      return {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: `Candidate not found: ${input.candidate_id}`,
          cause: error,
        },
      };
    }
    return {
      ok: false,
      error: {
        code: error instanceof StorageError ? 'STORAGE_FAILED' : 'UNKNOWN',
        message:
          error instanceof Error ? error.message : 'Failed to score Candidate.',
        cause: error,
      },
    };
  }
}
