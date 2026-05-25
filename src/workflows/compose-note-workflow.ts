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
import { transition_source } from '../domain/state-machine.js';
import type { StorageConfig } from '../storage/config.js';
import { StorageError } from '../storage/errors.js';
import { create_note, note_exists } from '../storage/note-repo.js';
import { get_source, save_source } from '../storage/source-repo.js';
import {
  evidence_locator_refs_from_segments,
  read_processed_artifacts,
} from '../storage/artifact-store.js';
import { render_note_markdown } from '../notes/render-markdown.js';
import { summarize_note, type NoteSummary } from './note-summary.js';
import { summarize_source, type SourceSummary } from './source-summary.js';
import type { NextAction, WorkflowResult } from './types.js';

export type ComposeNoteWorkflowInput = {
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
  save_source_fn?: typeof save_source;
};

export type ComposeNoteWorkflowData = {
  source_id: string;
  note_id: string;
  note: NoteSummary;
  source: SourceSummary;
};

export async function compose_note_workflow(
  input: ComposeNoteWorkflowInput,
): Promise<WorkflowResult<ComposeNoteWorkflowData>> {
  const context = { config: input.storage_config, cwd: input.cwd };

  try {
    const source = await get_source(input.source_id, context);
    if (source.status !== 'approved_for_note') {
      return invalid_input(
        `Source must be approved_for_note before note compose. Current status: ${source.status}`,
      );
    }
    if (source.draft_understanding === null) {
      return invalid_input(
        'Source must have draft_understanding before note compose.',
      );
    }

    const timestamp = (input.now ?? new Date()).toISOString();
    const artifacts = await read_processed_artifacts(source, context);
    const source_refs = build_source_refs(source, artifacts.segments);
    const allowed_evidence_refs = new Set(
      source_refs.flatMap((ref) => ref.evidence_refs),
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
        related_notes: [],
      },
    });

    const unsupported = candidate.conclusions.filter(
      (item) => !source.discussion_summary.confirmed_points.includes(item),
    );
    if (unsupported.length > 0) {
      return invalid_input('Note conclusions must come from confirmed_points.');
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

    const note_id = await create_available_note_id({
      title: candidate.title,
      now: input.now ?? new Date(),
      storage_config: input.storage_config,
      cwd: input.cwd,
    });
    const note = parse_note({
      ...candidate,
      id: note_id,
      slug: create_slug(candidate.title),
      status: 'draft',
      version: 1,
      root_note_id: note_id,
      supersedes_note_id: null,
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
    const markdown = render_note_markdown(note);
    const created_note = await create_note({ note, markdown }, context);

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

    try {
      await (input.save_source_fn ?? save_source)(updated_source, context);
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'PARTIAL_FAILURE',
          message: 'Note created but Source update failed.',
          cause: error,
        },
        next_actions: next_actions_for_note(created_note.id),
      };
    }

    return {
      ok: true,
      data: {
        source_id: source.id,
        note_id: created_note.id,
        note: summarize_note(created_note),
        source: summarize_source(updated_source),
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
          error instanceof Error ? error.message : 'Failed to compose Note.',
        cause: error,
      },
    };
  }
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
): WorkflowResult<ComposeNoteWorkflowData> {
  return { ok: false, error: { code: 'INVALID_INPUT', message } };
}

function next_actions_for_note(note_id: string): NextAction[] {
  return [{ label: 'Lint note', command: `ai-knowledge note lint ${note_id}` }];
}
