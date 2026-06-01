import { note_agent } from '../agents/note-agent.js';
import type { NoteCandidate } from '../agents/schemas.js';
import {
  create_llm_client,
  type AnthropicMessagesApi,
} from '../agents/llm-client.js';
import type { LlmClient } from '../agents/types.js';
import { create_note_id } from '../domain/ids.js';
import {
  default_quality_checks,
  parse_note,
  type SourceRef,
} from '../domain/note.js';
import type { Source } from '../domain/source.js';
import { create_slug } from '../domain/slug.js';
import { transition_note, transition_source } from '../domain/state-machine.js';
import type { StorageConfig } from '../storage/config.js';
import { StorageError } from '../storage/errors.js';
import { remove_index_entry } from '../storage/index-repo.js';
import {
  create_note,
  get_note,
  note_exists,
  save_note,
} from '../storage/note-repo.js';
import { get_source, save_source } from '../storage/source-repo.js';
import {
  evidence_locator_refs_from_segments,
  read_processed_artifacts,
} from '../storage/artifact-store.js';
import { render_note_markdown } from '../notes/render-markdown.js';
import { summarize_note, type NoteSummary } from './note-summary.js';
import { summarize_source, type SourceSummary } from './source-summary.js';
import type { NextAction, WorkflowResult } from './types.js';

export type SupersedeNoteWorkflowInput = {
  old_note_id: string;
  source_id: string;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
  now?: Date;
  llm_client?: LlmClient;
  messages_api?: AnthropicMessagesApi;
  compose?: (input: {
    llm_client: LlmClient;
    agent_input: Parameters<typeof note_agent>[0]['agent_input'];
  }) => Promise<NoteCandidate>;
  confirmed_related_note_ids?: string[];
  save_old_note_fn?: typeof save_note;
  save_source_fn?: typeof save_source;
  remove_index_entry_fn?: typeof remove_index_entry;
};

export type SupersedeNoteWorkflowData = {
  old_note_id: string;
  new_note_id: string;
  old_note: NoteSummary;
  new_note: NoteSummary;
  source: SourceSummary;
  index_entry_removed: boolean;
};

export async function supersede_note_workflow(
  input: SupersedeNoteWorkflowInput,
): Promise<WorkflowResult<SupersedeNoteWorkflowData>> {
  const context = { config: input.storage_config, cwd: input.cwd };

  try {
    const old_note = await get_note(input.old_note_id, context);
    if (old_note.status !== 'approved') {
      return invalid_state(
        `Old Note must be approved before supersede. Current status: ${old_note.status}`,
      );
    }

    const source = await get_source(input.source_id, context);
    if (source.status !== 'approved_for_note') {
      return invalid_state(
        `Source must be approved_for_note before supersede. Current status: ${source.status}`,
      );
    }
    if (source.draft_understanding === null) {
      return invalid_state(
        'Source must have draft_understanding before supersede.',
      );
    }

    const timestamp = (input.now ?? new Date()).toISOString();
    const artifacts = await read_processed_artifacts(source, context);
    const source_refs = build_source_refs(source, artifacts.segments);
    const allowed_evidence_refs = new Set(
      source_refs.flatMap((ref) => ref.evidence_refs),
    );
    const confirmed_related_notes = await load_confirmed_related_notes(
      input.confirmed_related_note_ids ?? [],
      context,
    );
    const confirmed_related_note_ids = new Set(
      confirmed_related_notes.map((note) => note.note_id),
    );
    const llm_client =
      input.llm_client ?? create_llm_client({}, input.messages_api);
    const compose = input.compose ?? note_agent;
    const candidate = await compose({
      llm_client,
      agent_input: {
        source,
        draft_understanding: source.draft_understanding,
        discussion_summary: source.discussion_summary,
        source_refs,
        related_notes: confirmed_related_notes,
      },
    });

    const unsupported = candidate.conclusions.filter(
      (item) => !source.discussion_summary.confirmed_points.includes(item),
    );
    if (unsupported.length > 0) {
      return invalid_input('Note conclusions must come from confirmed_points.');
    }

    const unconfirmed_related_note_ids = candidate.related_note_ids.filter(
      (note_id) => !confirmed_related_note_ids.has(note_id),
    );
    if (unconfirmed_related_note_ids.length > 0) {
      return invalid_input(
        `Note related_note_ids must be confirmed before composition: ${unconfirmed_related_note_ids.join(', ')}`,
      );
    }

    const invalid_evidence_refs = candidate.source_refs.flatMap((ref) =>
      ref.evidence_refs.filter(
        (evidence_ref) => !allowed_evidence_refs.has(evidence_ref),
      ),
    );
    if (invalid_evidence_refs.length > 0) {
      return invalid_input(
        `Note evidence_refs must come from processed segment locators: ${invalid_evidence_refs.join(', ')}`,
      );
    }

    const new_note_id = await create_available_note_id({
      title: candidate.title,
      now: input.now ?? new Date(),
      storage_config: input.storage_config,
      cwd: input.cwd,
    });
    const new_note = parse_note({
      ...candidate,
      id: new_note_id,
      slug: create_slug(candidate.title),
      status: 'draft',
      version: old_note.version + 1,
      root_note_id: old_note.root_note_id,
      supersedes_note_id: old_note.id,
      superseded_by_note_id: null,
      created_at: timestamp,
      updated_at: timestamp,
      approved_at: null,
      approval_context: {
        source_id: source.id,
        discussion_ref: 'discussion.jsonl',
        approved_from_summary_version:
          source.discussion_summary.summary_version,
      },
      render_metadata: {
        markdown_template_version: 'v1',
      },
      quality_checks: default_quality_checks,
    });
    const created_note = await create_note(
      { note: new_note, markdown: render_note_markdown(new_note) },
      context,
    );

    const updated_old_note = parse_note({
      ...transition_note(old_note, 'superseded'),
      superseded_by_note_id: created_note.id,
      updated_at: timestamp,
    });
    const updated_source = {
      ...transition_source(
        {
          ...source,
          note_ids: [...source.note_ids, created_note.id],
          updated_at: timestamp,
        },
        'noted',
      ),
      note_ids: [...source.note_ids, created_note.id],
      updated_at: timestamp,
    } satisfies Source;

    let index_entry_removed = false;
    try {
      index_entry_removed = await (
        input.remove_index_entry_fn ?? remove_index_entry
      )(old_note.id, context);
      await (input.save_old_note_fn ?? save_note)(updated_old_note, context);
      await (input.save_source_fn ?? save_source)(updated_source, context);
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'PARTIAL_FAILURE',
          message: 'New Note created but supersede finalization failed.',
          cause: error,
        },
        next_actions: next_actions_for_note(created_note.id),
      };
    }

    return {
      ok: true,
      data: {
        old_note_id: old_note.id,
        new_note_id: created_note.id,
        old_note: summarize_note(updated_old_note),
        new_note: summarize_note(created_note),
        source: summarize_source(updated_source),
        index_entry_removed,
      },
      next_actions: next_actions_for_note(created_note.id),
    };
  } catch (error) {
    if (error instanceof StorageError && error.code === 'NOT_FOUND') {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: error.message, cause: error },
      };
    }
    return {
      ok: false,
      error: {
        code: error instanceof StorageError ? 'STORAGE_FAILED' : 'AGENT_FAILED',
        message:
          error instanceof Error ? error.message : 'Failed to supersede Note.',
        cause: error,
      },
    };
  }
}

async function load_confirmed_related_notes(
  note_ids: string[],
  context: { config?: Partial<StorageConfig>; cwd?: string },
): Promise<
  Array<{
    note_id: string;
    title: string;
    summary: string;
    relevant_points: string[];
  }>
> {
  const unique_note_ids = Array.from(new Set(note_ids));
  const notes = await Promise.all(
    unique_note_ids.map(async (note_id) => get_note(note_id, context)),
  );

  const non_approved = notes.filter((note) => note.status !== 'approved');
  if (non_approved.length > 0) {
    throw new Error(
      `Confirmed related notes must be approved: ${non_approved
        .map((note) => note.id)
        .join(', ')}`,
    );
  }

  return notes.map((note) => ({
    note_id: note.id,
    title: note.title,
    summary: note.current_understanding,
    relevant_points: note.conclusions,
  }));
}

function build_source_refs(
  source: Source,
  segments: Parameters<typeof evidence_locator_refs_from_segments>[0],
): SourceRef[] {
  return [
    {
      source_id: source.id,
      source_title: source.title,
      source_url: source.url,
      evidence_refs: evidence_locator_refs_from_segments(segments),
    },
  ];
}

async function create_available_note_id(input: {
  title: string;
  now: Date;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
}): Promise<string> {
  const slug = create_slug(input.title);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const note_id = create_note_id({
      date: input.now,
      slug,
      suffix: attempt === 0 ? undefined : String(attempt + 1).padStart(2, '0'),
    });
    if (
      !(await note_exists(note_id, {
        config: input.storage_config,
        cwd: input.cwd,
      }))
    ) {
      return note_id;
    }
  }
  throw new Error('Failed to create unique note id.');
}

function invalid_input(
  message: string,
): WorkflowResult<SupersedeNoteWorkflowData> {
  return { ok: false, error: { code: 'INVALID_INPUT', message } };
}

function invalid_state(
  message: string,
): WorkflowResult<SupersedeNoteWorkflowData> {
  return { ok: false, error: { code: 'INVALID_STATE', message } };
}

function next_actions_for_note(note_id: string): NextAction[] {
  return [{ label: 'Lint note', command: `ai-knowledge note lint ${note_id}` }];
}
