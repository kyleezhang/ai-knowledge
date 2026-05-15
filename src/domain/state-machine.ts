import type { Source, SourceStatus } from './source.js';

const source_transitions: Record<SourceStatus, readonly SourceStatus[]> = {
  ingested: ['processing'],
  processing: ['processed', 'failed'],
  processed: ['understanding_ready', 'failed'],
  understanding_ready: ['discussing'],
  discussing: ['approved_for_note', 'failed'],
  approved_for_note: ['noted'],
  noted: ['archived'],
  archived: [],
  failed: ['processing', 'processed'],
};

export function transition_source(
  source: Source,
  target_status: SourceStatus,
): Source {
  const allowed = source_transitions[source.status];
  if (!allowed.includes(target_status)) {
    throw new Error(
      `Invalid source transition: ${source.status} -> ${target_status}`,
    );
  }

  return {
    ...source,
    status: target_status,
  };
}
