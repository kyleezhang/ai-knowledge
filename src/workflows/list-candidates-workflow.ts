import {
  CandidateStatusSchema,
  type CandidateStatus,
} from '../domain/candidate.js';
import type { StorageConfig } from '../storage/config.js';
import { StorageError } from '../storage/errors.js';
import { list_candidates } from '../storage/candidate-repo.js';
import {
  summarize_candidate,
  type CandidateSummary,
} from './candidate-summary.js';
import type { WorkflowResult } from './types.js';

export type ListCandidatesWorkflowInput = {
  status?: CandidateStatus;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
};

export type ListCandidatesWorkflowData = {
  candidates: CandidateSummary[];
};

export async function list_candidates_workflow(
  input: ListCandidatesWorkflowInput = {},
): Promise<WorkflowResult<ListCandidatesWorkflowData>> {
  try {
    if (input.status !== undefined) {
      CandidateStatusSchema.parse(input.status);
    }
    const candidates = await list_candidates(
      { status: input.status },
      { config: input.storage_config, cwd: input.cwd },
    );
    return {
      ok: true,
      data: { candidates: candidates.map(summarize_candidate) },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code:
          error instanceof StorageError ? 'STORAGE_FAILED' : 'INVALID_INPUT',
        message:
          error instanceof Error ? error.message : 'Failed to list Candidates.',
        cause: error,
      },
    };
  }
}
