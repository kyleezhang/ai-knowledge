import type { Source } from '../domain/source.js';

export type SourceSummary = {
  id: string;
  title: string;
  status: Source['status'];
  ingest_type: Source['ingest_type'];
  content_type: Source['content_type'];
  updated_at: string;
  processing_artifacts: Source['processing_artifacts'];
  draft_understanding_summary: string | null;
  discussion_status: Source['discussion_summary']['discussion_status'];
  note_ids: string[];
};

export function summarize_source(source: Source): SourceSummary {
  return {
    id: source.id,
    title: source.title,
    status: source.status,
    ingest_type: source.ingest_type,
    content_type: source.content_type,
    updated_at: source.updated_at,
    processing_artifacts: source.processing_artifacts,
    draft_understanding_summary: source.draft_understanding?.summary ?? null,
    discussion_status: source.discussion_summary.discussion_status,
    note_ids: source.note_ids,
  };
}
