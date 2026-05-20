import { z } from 'zod';

export const NoteStatusSchema = z.enum([
  'draft',
  'approved',
  'archived',
  'superseded',
]);

export const SourceRefSchema = z.object({
  source_id: z.string(),
  source_title: z.string(),
  source_url: z.string().nullable(),
  evidence_refs: z.array(z.string()),
});

export const ApprovalContextSchema = z.object({
  source_id: z.string(),
  discussion_ref: z.string(),
  approved_from_summary_version: z.number().int().positive(),
});

export const QualityChecksSchema = z.object({
  status: z.enum(['passed', 'failed']),
  template_complete: z.boolean(),
  source_links_present: z.boolean(),
  empty_sections: z.array(z.string()),
  last_checked_at: z.string().nullable(),
});

export const RenderMetadataSchema = z.object({
  markdown_template_version: z.string(),
});

export const NoteSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  status: NoteStatusSchema,
  version: z.number().int().positive(),
  root_note_id: z.string(),
  supersedes_note_id: z.string().nullable(),
  superseded_by_note_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  approved_at: z.string().nullable(),
  conclusions: z.array(z.string()),
  why_it_matters: z.array(z.string()),
  current_understanding: z.string(),
  open_questions: z.array(z.string()),
  related_note_ids: z.array(z.string()),
  source_refs: z.array(SourceRefSchema),
  approval_context: ApprovalContextSchema,
  render_metadata: RenderMetadataSchema,
  quality_checks: QualityChecksSchema,
});

export type Note = z.infer<typeof NoteSchema>;
export type NoteStatus = z.infer<typeof NoteStatusSchema>;
export type SourceRef = z.infer<typeof SourceRefSchema>;

export const default_quality_checks = {
  status: 'failed',
  template_complete: false,
  source_links_present: false,
  empty_sections: [],
  last_checked_at: null,
} satisfies Note['quality_checks'];

export function validate_note_invariants(note: Note): void {
  if (note.version < 1) {
    throw new Error('note version must be positive');
  }

  if (note.version === 1 && note.root_note_id !== note.id) {
    throw new Error('v1 note root_note_id must equal id');
  }

  if (note.source_refs.length === 0) {
    throw new Error('note must have source_refs');
  }

  if (note.status === 'approved') {
    if (note.approved_at === null) {
      throw new Error('approved note must have approved_at');
    }
    if (note.quality_checks.status !== 'passed') {
      throw new Error('approved note must pass quality_checks');
    }
    if (note.conclusions.length === 0) {
      throw new Error('approved note must have conclusions');
    }
    if (note.why_it_matters.length === 0) {
      throw new Error('approved note must have why_it_matters');
    }
  }

  if (note.status === 'superseded' && note.superseded_by_note_id === null) {
    throw new Error('superseded note must have superseded_by_note_id');
  }

  if (
    note.supersedes_note_id !== null &&
    note.supersedes_note_id === note.superseded_by_note_id
  ) {
    throw new Error('supersedes_note_id and superseded_by_note_id must differ');
  }
}

export function parse_note(value: unknown): Note {
  const note = NoteSchema.parse(value);
  validate_note_invariants(note);
  return note;
}
