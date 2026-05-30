import type { Candidate } from './candidate.js';
import { create_slug } from './slug.js';

export const candidate_recommendation_threshold = 8;

const ai_keywords = [
  'ai',
  'agent',
  'agents',
  'llm',
  'model',
  'machine learning',
  'deep learning',
  'rag',
  'inference',
  'training',
  'transformer',
  'neural',
];

export type CandidateCanonicalKeys = {
  canonical_url: string;
  external_ref: string;
  title_slug: string;
};

export type CandidateDuplicateResult =
  | {
      duplicate: false;
    }
  | {
      duplicate: true;
      reason: 'canonical_url' | 'external_ref' | 'title_slug';
      existing_candidate_id: string;
    };

export function candidate_canonical_keys(
  candidate: Pick<Candidate, 'url' | 'external_ref' | 'title'>,
): CandidateCanonicalKeys {
  return {
    canonical_url: canonicalize_url(candidate.url),
    external_ref: `${candidate.external_ref.platform}:${candidate.external_ref.id}`,
    title_slug: create_slug(candidate.title),
  };
}

export function detect_duplicate_candidate(
  candidate: Pick<Candidate, 'url' | 'external_ref' | 'title'>,
  existing_candidates: Candidate[],
): CandidateDuplicateResult {
  const keys = candidate_canonical_keys(candidate);
  for (const existing of existing_candidates) {
    const existing_keys = candidate_canonical_keys(existing);
    if (keys.canonical_url === existing_keys.canonical_url) {
      return {
        duplicate: true,
        reason: 'canonical_url',
        existing_candidate_id: existing.id,
      };
    }
    if (keys.external_ref === existing_keys.external_ref) {
      return {
        duplicate: true,
        reason: 'external_ref',
        existing_candidate_id: existing.id,
      };
    }
    if (keys.title_slug === existing_keys.title_slug) {
      return {
        duplicate: true,
        reason: 'title_slug',
        existing_candidate_id: existing.id,
      };
    }
  }

  return { duplicate: false };
}

export function score_candidate(
  candidate: Candidate,
  input: { scored_at: string; threshold?: number },
): Candidate {
  const filtered = filter_candidate(candidate);
  if (filtered !== null) {
    return {
      ...candidate,
      status: 'dismissed',
      scored_at: input.scored_at,
      score: {
        total: 0,
        breakdown: {
          relevance: 0,
          learning_value: 0,
          novelty: 0,
          discussability: 0,
        },
        reason: filtered,
      },
    };
  }

  const text = candidate_text(candidate);
  const relevance = score_relevance(text, candidate.tags);
  const learning_value = score_learning_value(candidate);
  const novelty = score_novelty(candidate);
  const discussability = score_discussability(candidate);
  const total = relevance + learning_value + novelty + discussability;
  const threshold = input.threshold ?? candidate_recommendation_threshold;
  const status = total >= threshold ? 'recommended' : 'dismissed';

  return {
    ...candidate,
    status,
    scored_at: input.scored_at,
    score: {
      total,
      breakdown: {
        relevance,
        learning_value,
        novelty,
        discussability,
      },
      reason:
        status === 'recommended'
          ? `Recommended: score ${total} reached threshold ${threshold}.`
          : `Dismissed: score ${total} below threshold ${threshold}.`,
    },
  };
}

function filter_candidate(candidate: Candidate): string | null {
  if (candidate.title.trim().length < 4) {
    return 'Dismissed: title is too short to judge learning value.';
  }
  if (candidate.summary.trim().length < 12) {
    return 'Dismissed: summary is too short to judge learning value.';
  }
  if (!contains_ai_signal(candidate_text(candidate), candidate.tags)) {
    return 'Dismissed: candidate is not clearly related to AI learning.';
  }
  return null;
}

function score_relevance(text: string, tags: string[]): number {
  const signal_count = ai_keywords.filter((keyword) =>
    text.includes(keyword),
  ).length;
  const tag_signal = tags.some((tag) =>
    ai_keywords.includes(tag.toLowerCase()),
  );
  if (signal_count >= 2 || tag_signal) return 3;
  if (signal_count === 1) return 2;
  return 1;
}

function score_learning_value(candidate: Candidate): number {
  if (candidate.summary.length >= 80) return 3;
  if (candidate.summary.length >= 40) return 2;
  return 1;
}

function score_novelty(candidate: Candidate): number {
  const text = candidate_text(candidate);
  if (
    text.includes('new') ||
    text.includes('launch') ||
    text.includes('research')
  ) {
    return 3;
  }
  if (
    candidate.source_type === 'github_trending' ||
    candidate.source_type === 'hacker_news'
  ) {
    return 2;
  }
  return 1;
}

function score_discussability(candidate: Candidate): number {
  const text = candidate_text(candidate);
  if (
    text.includes('why') ||
    text.includes('how') ||
    text.includes('tradeoff')
  ) {
    return 3;
  }
  if (candidate.summary.length >= 40) return 2;
  return 1;
}

function contains_ai_signal(text: string, tags: string[]): boolean {
  return (
    ai_keywords.some((keyword) => text.includes(keyword)) ||
    tags.some((tag) => ai_keywords.includes(tag.toLowerCase()))
  );
}

function candidate_text(
  candidate: Pick<Candidate, 'title' | 'summary'>,
): string {
  return `${candidate.title} ${candidate.summary}`.toLowerCase();
}

function canonicalize_url(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.search = '';
    return parsed.href.replace(/\/$/u, '').toLowerCase();
  } catch {
    return url.trim().replace(/\/$/u, '').toLowerCase();
  }
}
