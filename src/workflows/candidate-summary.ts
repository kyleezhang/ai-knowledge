import type { Candidate } from '../domain/candidate.js';

export type CandidateSummary = {
  id: string;
  status: Candidate['status'];
  source_type: Candidate['source_type'];
  title: string;
  summary: string;
  url: string;
  score: Candidate['score'];
  collected_at: string;
  converted_source_id: string | null;
};

export function summarize_candidate(candidate: Candidate): CandidateSummary {
  return {
    id: candidate.id,
    status: candidate.status,
    source_type: candidate.source_type,
    title: candidate.title,
    summary: candidate.summary,
    url: candidate.url,
    score: candidate.score,
    collected_at: candidate.collected_at,
    converted_source_id: candidate.converted_source_id,
  };
}
