import type { SourceIngestType } from './source.js';
import { format_local_date_for_id } from './time.js';

export function create_source_id(input: {
  date: Date;
  ingest_type: SourceIngestType;
  slug: string;
  timezone?: string;
  suffix?: string;
}): string {
  const date_part = format_local_date_for_id(input.date, input.timezone);
  const base = `src_${date_part}_${input.ingest_type}_${input.slug}`;
  return input.suffix === undefined ? base : `${base}_${input.suffix}`;
}
