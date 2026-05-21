import { create_source_id } from '../domain/ids.js';
import {
  parse_source,
  type Source,
  type SourceIngestType,
} from '../domain/source.js';
import { get_source } from '../storage/source-repo.js';
import type { StorageConfig } from '../storage/config.js';
import type { NextAction } from './types.js';

export async function create_available_source_id(input: {
  now: Date;
  slug: string;
  ingest_type: SourceIngestType;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
}): Promise<string> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const source_id = create_source_id({
      date: input.now,
      ingest_type: input.ingest_type,
      slug: input.slug,
      suffix: attempt === 0 ? undefined : String(attempt + 1).padStart(2, '0'),
    });

    try {
      await get_source(source_id, {
        config: input.storage_config,
        cwd: input.cwd,
      });
    } catch {
      return source_id;
    }
  }

  throw new Error('Failed to create unique source id.');
}

export function build_user_import_source(input: {
  source_id: string;
  title: string;
  ingest_type: SourceIngestType;
  content_type: Source['content_type'];
  user_input_type: NonNullable<Source['origin']['user_input_type']>;
  timestamp: string;
  url?: string | null;
}): Source {
  return parse_source({
    id: input.source_id,
    title: input.title,
    status: 'ingested',
    ingest_type: input.ingest_type,
    content_type: input.content_type,
    origin: {
      type: 'user_import',
      candidate_id: null,
      user_input_type: input.user_input_type,
    },
    origin_candidate_id: null,
    url: input.url ?? null,
    author: null,
    published_at: null,
    ingested_at: input.timestamp,
    updated_at: input.timestamp,
    processing_artifacts: {},
    draft_understanding: null,
    discussion_summary: {
      discussion_status: 'open',
      summary_version: 0,
      confirmed_points: [],
      open_questions: [],
      unresolved_issues: [],
      next_prompts: [],
      ready_for_approval: false,
      last_updated_at: input.timestamp,
    },
    note_ids: [],
  } satisfies Source);
}

export function next_actions_for_source(source_id: string): NextAction[] {
  return [
    {
      label: 'Process source',
      command: `ai-knowledge source process ${source_id}`,
    },
  ];
}
