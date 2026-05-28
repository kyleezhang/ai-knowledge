import type { Candidate, CandidateSourceType } from '../domain/candidate.js';
import { create_candidate_id } from '../domain/ids.js';
import { create_slug } from '../domain/slug.js';

export type CollectorErrorCode =
  | 'FETCH_FAILED'
  | 'PARSE_FAILED'
  | 'NORMALIZE_FAILED';

export class CollectorError extends Error {
  readonly code: CollectorErrorCode;
  readonly details?: unknown;

  constructor(input: {
    code: CollectorErrorCode;
    message: string;
    details?: unknown;
    cause?: unknown;
  }) {
    super(input.message, { cause: input.cause });
    this.name = 'CollectorError';
    this.code = input.code;
    this.details = input.details;
  }
}

export type CollectedCandidateInput = {
  source_type: CandidateSourceType;
  title: string;
  summary: string;
  url: string;
  author: string | null;
  published_at: string | null;
  tags: string[];
  external_ref: Candidate['external_ref'];
};

export type CollectorResult =
  | {
      ok: true;
      candidates: CollectedCandidateInput[];
    }
  | {
      ok: false;
      error: CollectorError;
    };

export type CollectorFetch = (url: string) => Promise<string>;

export function build_new_candidate(input: {
  collected: CollectedCandidateInput;
  collected_at: string;
  suffix?: string;
}): Candidate {
  return {
    id: create_candidate_id({
      date: new Date(input.collected_at),
      source_type: input.collected.source_type,
      slug: create_slug(input.collected.title),
      suffix: input.suffix,
    }),
    source_type: input.collected.source_type,
    title: input.collected.title,
    summary: input.collected.summary,
    url: input.collected.url,
    author: input.collected.author,
    published_at: input.collected.published_at,
    collected_at: input.collected_at,
    scored_at: null,
    tags: input.collected.tags,
    status: 'new',
    score: {
      total: 0,
      breakdown: {
        relevance: 0,
        learning_value: 0,
        novelty: 0,
        discussability: 0,
      },
      reason: 'Not scored yet.',
    },
    external_ref: input.collected.external_ref,
    converted_source_id: null,
  };
}

export async function fetch_text(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'ai-knowledge/0.1.0',
      accept: 'text/html,application/json,text/plain',
    },
  });
  if (!response.ok) {
    throw new Error(`Unexpected response status: ${response.status}`);
  }
  return response.text();
}
