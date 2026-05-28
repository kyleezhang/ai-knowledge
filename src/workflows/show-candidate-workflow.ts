import type { StorageConfig } from '../storage/config.js';
import { StorageError } from '../storage/errors.js';
import { get_candidate } from '../storage/candidate-repo.js';
import {
  summarize_candidate,
  type CandidateSummary,
} from './candidate-summary.js';
import type { WorkflowResult } from './types.js';

export type ShowCandidateWorkflowInput = {
  candidate_id: string;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
};

export type ShowCandidateWorkflowData = {
  candidate: CandidateSummary;
};

export async function show_candidate_workflow(
  input: ShowCandidateWorkflowInput,
): Promise<WorkflowResult<ShowCandidateWorkflowData>> {
  try {
    const candidate = await get_candidate(input.candidate_id, {
      config: input.storage_config,
      cwd: input.cwd,
    });
    return { ok: true, data: { candidate: summarize_candidate(candidate) } };
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
          error instanceof Error ? error.message : 'Failed to show Candidate.',
        cause: error,
      },
    };
  }
}
