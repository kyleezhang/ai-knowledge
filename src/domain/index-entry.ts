import { z } from 'zod';

export const IndexEntrySchema = z.object({
  note_id: z.string(),
  title: z.string(),
  summary: z.string(),
  keywords: z.array(z.string()),
  tags: z.array(z.string()),
  status: z.literal('approved'),
  approved_at: z.string(),
  related_note_ids: z.array(z.string()),
  vector_ref: z.string().nullable(),
});

export type IndexEntry = z.infer<typeof IndexEntrySchema>;

export function validate_index_entry(entry: IndexEntry): void {
  if (entry.note_id.trim().length === 0) {
    throw new Error('index entry must have note_id');
  }
  if (entry.approved_at.trim().length === 0) {
    throw new Error('index entry must have approved_at');
  }
  if (entry.summary.trim().length === 0) {
    throw new Error('index entry must have summary');
  }
}

export function parse_index_entry(value: unknown): IndexEntry {
  const entry = IndexEntrySchema.parse(value);
  validate_index_entry(entry);
  return entry;
}
