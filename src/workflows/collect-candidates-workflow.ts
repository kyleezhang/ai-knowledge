import {
  detect_duplicate_candidate,
  score_candidate,
} from '../domain/candidate-recommendation.js';
import type { StorageConfig } from '../storage/config.js';
import {
  create_candidate,
  list_candidates,
} from '../storage/candidate-repo.js';
import { StorageError } from '../storage/errors.js';
import { collect_github_trending } from '../collectors/github-trending-collector.js';
import { collect_hacker_news } from '../collectors/hacker-news-collector.js';
import {
  CollectorError,
  build_new_candidate,
  type CollectorFetch,
  type CollectorResult,
} from '../collectors/types.js';
import {
  summarize_candidate,
  type CandidateSummary,
} from './candidate-summary.js';
import type { WorkflowResult } from './types.js';

export const CandidateCollectorProviderValues = [
  'github-trending',
  'hacker-news',
] as const;

export type CandidateCollectorProvider =
  (typeof CandidateCollectorProviderValues)[number];

export type CollectCandidatesWorkflowInput = {
  provider: CandidateCollectorProvider;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
  now?: Date;
  fetcher?: CollectorFetch;
  collect?: () => Promise<CollectorResult>;
};

export type CollectedCandidateResult =
  | {
      status: 'created';
      candidate: CandidateSummary;
    }
  | {
      status: 'duplicate';
      title: string;
      reason: string;
      existing_candidate_id: string;
    };

export type CollectCandidatesWorkflowData = {
  provider: CandidateCollectorProvider;
  candidates: CandidateSummary[];
  results: CollectedCandidateResult[];
};

export async function collect_candidates_workflow(
  input: CollectCandidatesWorkflowInput,
): Promise<WorkflowResult<CollectCandidatesWorkflowData>> {
  try {
    const result = await run_collector(input);
    if (!result.ok) {
      return {
        ok: false,
        error: {
          code: 'PROCESSING_FAILED',
          message: result.error.message,
          details: { code: result.error.code, details: result.error.details },
          cause: result.error,
        },
      };
    }

    const context = { config: input.storage_config, cwd: input.cwd };
    const timestamp = (input.now ?? new Date()).toISOString();
    const existing_candidates = await list_candidates({}, context);
    const results: CollectedCandidateResult[] = [];
    const candidates = [];

    for (const [index, collected] of result.candidates.entries()) {
      const candidate = build_new_candidate({
        collected,
        collected_at: timestamp,
        suffix: index === 0 ? undefined : String(index + 1).padStart(2, '0'),
      });
      const duplicate = detect_duplicate_candidate(candidate, [
        ...existing_candidates,
        ...candidates,
      ]);
      if (duplicate.duplicate) {
        results.push({
          status: 'duplicate',
          title: collected.title,
          reason: duplicate.reason,
          existing_candidate_id: duplicate.existing_candidate_id,
        });
        continue;
      }

      const saved = await create_candidate(
        score_candidate(candidate, { scored_at: timestamp }),
        context,
      );
      candidates.push(saved);
      results.push({
        status: 'created',
        candidate: summarize_candidate(saved),
      });
    }

    return {
      ok: true,
      data: {
        provider: input.provider,
        candidates: candidates.map(summarize_candidate),
        results,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: error instanceof StorageError ? 'STORAGE_FAILED' : 'UNKNOWN',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to collect Candidates.',
        cause: error,
      },
    };
  }
}

async function run_collector(
  input: CollectCandidatesWorkflowInput,
): Promise<CollectorResult> {
  if (input.collect !== undefined) {
    return input.collect();
  }

  if (input.provider === 'github-trending') {
    return collect_github_trending({ fetcher: input.fetcher });
  }
  if (input.provider === 'hacker-news') {
    return collect_hacker_news({ fetcher: input.fetcher });
  }

  return {
    ok: false,
    error: new CollectorError({
      code: 'NORMALIZE_FAILED',
      message: `Unsupported collector provider: ${String(input.provider)}`,
    }),
  };
}
