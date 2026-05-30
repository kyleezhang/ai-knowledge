import type { Candidate } from '../domain/candidate.js';
import { create_source_id } from '../domain/ids.js';
import { create_slug } from '../domain/slug.js';
import type { Source } from '../domain/source.js';
import type { StorageConfig } from '../storage/config.js';
import { get_candidate, update_candidate } from '../storage/candidate-repo.js';
import { StorageError } from '../storage/errors.js';
import { create_source, get_source } from '../storage/source-repo.js';
import {
  summarize_candidate,
  type CandidateSummary,
} from './candidate-summary.js';
import { summarize_source, type SourceSummary } from './source-summary.js';
import type { NextAction, WorkflowResult } from './types.js';

export type SelectCandidateWorkflowInput = {
  candidate_id: string;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
  now?: Date;
};

export type SelectCandidateWorkflowData = {
  candidate: CandidateSummary;
  source: SourceSummary;
  source_id: string;
};

export async function select_candidate_workflow(
  input: SelectCandidateWorkflowInput,
): Promise<WorkflowResult<SelectCandidateWorkflowData>> {
  const context = { config: input.storage_config, cwd: input.cwd };
  const now = input.now ?? new Date();
  const timestamp = now.toISOString();

  try {
    const candidate = await get_candidate(input.candidate_id, context);
    if (candidate.status !== 'recommended') {
      return invalid_state(
        `Candidate must be recommended before select. Current status: ${candidate.status}`,
      );
    }
    if (candidate.converted_source_id !== null) {
      return invalid_state('Candidate has already been converted to Source.');
    }

    const selected_candidate = await update_candidate(
      { ...candidate, status: 'selected' },
      context,
    );

    const source = await create_source_from_candidate({
      candidate: selected_candidate,
      now,
      timestamp,
      context,
    });

    const converted_candidate = await update_candidate(
      {
        ...selected_candidate,
        status: 'converted',
        converted_source_id: source.id,
      },
      context,
    );

    return {
      ok: true,
      data: {
        candidate: summarize_candidate(converted_candidate),
        source: summarize_source(source),
        source_id: source.id,
      },
      next_actions: next_actions_for_source(source.id),
    };
  } catch (error) {
    if (error instanceof StorageError && error.code === 'NOT_FOUND') {
      return {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: `Candidate not found: ${input.candidate_id}`,
          cause: error,
        },
      };
    }
    return {
      ok: false,
      error: {
        code: error instanceof StorageError ? 'STORAGE_FAILED' : 'UNKNOWN',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to select Candidate.',
        cause: error,
      },
    };
  }
}

async function create_source_from_candidate(input: {
  candidate: Candidate;
  now: Date;
  timestamp: string;
  context: { config?: Partial<StorageConfig>; cwd?: string };
}): Promise<Source> {
  const source_id = await create_available_source_id({
    title: input.candidate.title,
    now: input.now,
    context: input.context,
  });
  return create_source(
    {
      source: {
        id: source_id,
        title: input.candidate.title,
        status: 'ingested',
        ingest_type: 'candidate_selected',
        content_type: 'link',
        origin: {
          type: 'candidate',
          candidate_id: input.candidate.id,
          user_input_type: null,
        },
        origin_candidate_id: input.candidate.id,
        url: input.candidate.url,
        author: input.candidate.author,
        published_at: input.candidate.published_at,
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
      },
      raw_content: candidate_raw_markdown(input.candidate),
    },
    input.context,
  );
}

async function create_available_source_id(input: {
  title: string;
  now: Date;
  context: { config?: Partial<StorageConfig>; cwd?: string };
}): Promise<string> {
  const slug = create_slug(input.title);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const source_id = create_source_id({
      date: input.now,
      ingest_type: 'candidate_selected',
      slug,
      suffix: attempt === 0 ? undefined : String(attempt + 1).padStart(2, '0'),
    });
    try {
      await get_source(source_id, input.context);
    } catch (error) {
      if (error instanceof StorageError && error.code === 'NOT_FOUND') {
        return source_id;
      }
      throw error;
    }
  }
  throw new Error('Failed to create unique source id.');
}

function candidate_raw_markdown(candidate: Candidate): string {
  return [
    `# ${candidate.title}`,
    '',
    candidate.summary,
    '',
    `- source_type: ${candidate.source_type}`,
    `- url: ${candidate.url}`,
    `- author: ${candidate.author ?? ''}`,
    `- published_at: ${candidate.published_at ?? ''}`,
    `- tags: ${candidate.tags.join(', ')}`,
    `- candidate_id: ${candidate.id}`,
    '',
  ].join('\n');
}

function invalid_state(
  message: string,
): WorkflowResult<SelectCandidateWorkflowData> {
  return { ok: false, error: { code: 'INVALID_STATE', message } };
}

function next_actions_for_source(source_id: string): NextAction[] {
  return [
    {
      label: 'Process source',
      command: `ai-knowledge source process ${source_id}`,
    },
  ];
}
