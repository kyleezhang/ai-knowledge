import { z } from 'zod';

export const SourceStatusSchema = z.enum([
  'ingested',
  'processing',
  'processed',
  'understanding_ready',
  'discussing',
  'approved_for_note',
  'noted',
  'archived',
  'failed',
]);

export type SourceStatus = z.infer<typeof SourceStatusSchema>;

export const SourceIngestTypeSchema = z.enum([
  'upload_markdown',
  'upload_pdf',
  'input_url',
  'lark_doc',
  'feishu_doc',
  'candidate_selected',
]);

export const SourceContentTypeSchema = z.enum(['document', 'link']);

export const SourceOriginSchema = z.object({
  type: z.enum(['candidate', 'user_import']),
  candidate_id: z.string().nullable(),
  user_input_type: z
    .enum(['markdown', 'pdf', 'url', 'lark_doc', 'feishu_doc'])
    .nullable(),
});

export const DraftUnderstandingSchema = z.object({
  summary: z.string(),
  key_points: z.array(z.string()),
  uncertainties: z.array(z.string()),
  discussion_starters: z.array(z.string()),
  generated_at: z.string(),
});

export const DiscussionSummarySchema = z.object({
  discussion_status: z.enum([
    'open',
    'waiting_user',
    'ready_for_approval',
    'closed',
  ]),
  summary_version: z.number().int().nonnegative(),
  confirmed_points: z.array(z.string()),
  open_questions: z.array(z.string()),
  unresolved_issues: z.array(z.string()),
  next_prompts: z.array(z.string()),
  ready_for_approval: z.boolean(),
  last_updated_at: z.string(),
});

export const SourceLastErrorSchema = z.object({
  stage: z.string(),
  message: z.string(),
  occurred_at: z.string(),
});

export const FeishuDocSourceMetadataSchema = z.object({
  original_input: z.string(),
  title: z.string(),
  document_type: z.string(),
  imported_at: z.string(),
});

export const SourceMetadataSchema = z.object({
  feishu_doc: FeishuDocSourceMetadataSchema.optional(),
});

export const SourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: SourceStatusSchema,
  ingest_type: SourceIngestTypeSchema,
  content_type: SourceContentTypeSchema,
  origin: SourceOriginSchema,
  origin_candidate_id: z.string().nullable(),
  url: z.string().nullable(),
  author: z.string().nullable(),
  published_at: z.string().nullable(),
  ingested_at: z.string(),
  updated_at: z.string(),
  processing_artifacts: z.record(z.string(), z.string()),
  draft_understanding: DraftUnderstandingSchema.nullable(),
  discussion_summary: DiscussionSummarySchema,
  note_ids: z.array(z.string()),
  last_error: SourceLastErrorSchema.optional(),
  metadata: SourceMetadataSchema.optional(),
});

export type Source = z.infer<typeof SourceSchema>;
export type SourceIngestType = z.infer<typeof SourceIngestTypeSchema>;

const statuses_after_processing = new Set<SourceStatus>([
  'processed',
  'understanding_ready',
  'discussing',
  'approved_for_note',
  'noted',
]);

const statuses_after_understanding = new Set<SourceStatus>([
  'understanding_ready',
  'discussing',
  'approved_for_note',
  'noted',
]);

export function validate_source_invariants(source: Source): void {
  if (
    source.origin.type === 'user_import' &&
    source.origin_candidate_id !== null
  ) {
    throw new Error('user_import source must not have origin_candidate_id');
  }

  if (
    source.origin.type === 'user_import' &&
    source.origin.candidate_id !== null
  ) {
    throw new Error('user_import source origin.candidate_id must be null');
  }

  if (
    source.origin.type === 'candidate' &&
    source.origin_candidate_id === null
  ) {
    throw new Error('candidate source must have origin_candidate_id');
  }

  if (
    source.origin.type === 'candidate' &&
    source.origin.candidate_id === null
  ) {
    throw new Error('candidate source must have origin.candidate_id');
  }

  if (source.ingest_type === 'upload_markdown') {
    if (source.origin.type !== 'user_import') {
      throw new Error('upload_markdown source must be user_import');
    }
    if (source.origin.user_input_type !== 'markdown') {
      throw new Error(
        'upload_markdown source must have origin.user_input_type = markdown',
      );
    }
    if (source.content_type !== 'document') {
      throw new Error(
        'upload_markdown source must have content_type = document',
      );
    }
    if (source.url !== null) {
      throw new Error('upload_markdown source must have url = null');
    }
  }

  if (source.ingest_type === 'upload_pdf') {
    if (source.origin.type !== 'user_import') {
      throw new Error('upload_pdf source must be user_import');
    }
    if (source.origin.user_input_type !== 'pdf') {
      throw new Error(
        'upload_pdf source must have origin.user_input_type = pdf',
      );
    }
    if (source.content_type !== 'document') {
      throw new Error('upload_pdf source must have content_type = document');
    }
    if (source.url !== null) {
      throw new Error('upload_pdf source must have url = null');
    }
  }

  if (source.ingest_type === 'input_url') {
    if (source.origin.type !== 'user_import') {
      throw new Error('input_url source must be user_import');
    }
    if (source.origin.user_input_type !== 'url') {
      throw new Error(
        'input_url source must have origin.user_input_type = url',
      );
    }
    if (source.content_type !== 'link') {
      throw new Error('input_url source must have content_type = link');
    }
    if (source.url === null) {
      throw new Error('input_url source must have a non-null url');
    }
  }

  if (source.ingest_type === 'feishu_doc') {
    if (source.origin.type !== 'user_import') {
      throw new Error('feishu_doc source must be user_import');
    }
    if (source.origin.user_input_type !== 'feishu_doc') {
      throw new Error(
        'feishu_doc source must have origin.user_input_type = feishu_doc',
      );
    }
    if (source.content_type !== 'document') {
      throw new Error('feishu_doc source must have content_type = document');
    }
    if (source.url !== null) {
      throw new Error('feishu_doc source must have url = null');
    }
    if (source.metadata?.feishu_doc === undefined) {
      throw new Error('feishu_doc source must have metadata.feishu_doc');
    }
  }

  if (statuses_after_processing.has(source.status)) {
    const artifacts = source.processing_artifacts;
    if (
      artifacts.clean_text === undefined ||
      artifacts.segments === undefined ||
      artifacts.metadata === undefined
    ) {
      throw new Error(
        'processed source must have standard processing_artifacts',
      );
    }
  }

  if (
    statuses_after_understanding.has(source.status) &&
    source.draft_understanding === null
  ) {
    throw new Error('understanding source must have draft_understanding');
  }

  if (
    source.discussion_summary.ready_for_approval &&
    source.discussion_summary.confirmed_points.length === 0
  ) {
    throw new Error('ready discussion must have confirmed_points');
  }

  if (source.status === 'approved_for_note') {
    if (source.discussion_summary.confirmed_points.length === 0) {
      throw new Error('approved_for_note source must have confirmed_points');
    }

    if (source.discussion_summary.discussion_status !== 'closed') {
      throw new Error('approved_for_note source must have closed discussion');
    }

    if (source.last_error !== undefined) {
      throw new Error('approved_for_note source must not have last_error');
    }
  }

  if (source.status === 'noted' && source.note_ids.length === 0) {
    throw new Error('noted source must have note_ids');
  }

  if (source.status === 'failed' && source.last_error === undefined) {
    throw new Error('failed source must have last_error');
  }
}

export function parse_source(value: unknown): Source {
  const source = SourceSchema.parse(value);
  validate_source_invariants(source);
  return source;
}
