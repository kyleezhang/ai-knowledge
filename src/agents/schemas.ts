import { z } from 'zod';
import { SourceRefSchema } from '../domain/note.js';

export const DraftUnderstandingCandidateSchema = z.object({
  summary: z.string(),
  key_points: z.array(z.string()),
  uncertainties: z.array(z.string()),
  discussion_starters: z.array(z.string()),
});

export type DraftUnderstandingCandidate = z.infer<
  typeof DraftUnderstandingCandidateSchema
>;

export const DiscussionMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  created_at: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const DiscussionSummaryUpdateSchema = z.object({
  confirmed_points: z.array(z.string()),
  open_questions: z.array(z.string()),
  unresolved_issues: z.array(z.string()),
  next_prompts: z.array(z.string()),
  ready_for_approval: z.boolean(),
});

export const DiscussionAgentOutputSchema = z.object({
  assistant_message: z.string(),
  discussion_summary_update: DiscussionSummaryUpdateSchema,
});

export type DiscussionMessage = z.infer<typeof DiscussionMessageSchema>;
export type DiscussionSummaryUpdate = z.infer<
  typeof DiscussionSummaryUpdateSchema
>;
export type DiscussionAgentOutput = z.infer<typeof DiscussionAgentOutputSchema>;

export const NoteCandidateSchema = z.object({
  title: z.string(),
  conclusions: z.array(z.string()),
  why_it_matters: z.array(z.string()),
  current_understanding: z.string(),
  open_questions: z.array(z.string()),
  related_note_ids: z.array(z.string()),
  source_refs: z.array(SourceRefSchema),
});

export type NoteCandidate = z.infer<typeof NoteCandidateSchema>;

export const CitedNoteSchema = z.object({
  note_id: z.string(),
  title: z.string(),
  relevant_points: z.array(z.string()),
});

export const GroundedAnswerSchema = z.object({
  conclusion: z.string(),
  cited_notes: z.array(CitedNoteSchema),
  unconfirmed_materials: z.array(z.never()),
  limitations: z.array(z.string()),
});

export type CitedNote = z.infer<typeof CitedNoteSchema>;
export type GroundedAnswer = z.infer<typeof GroundedAnswerSchema>;
