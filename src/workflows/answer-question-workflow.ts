import { answer_agent } from '../agents/answer-agent.js';
import type { GroundedAnswer } from '../agents/schemas.js';
import {
  create_llm_client,
  type AnthropicMessagesApi,
} from '../agents/llm-client.js';
import type { EmbeddingProvider } from '../agents/embedding-provider.js';
import type { LlmClient } from '../agents/types.js';
import type {
  HybridRetrievalResult,
  MetadataFilter,
  UnconfirmedEvidence,
} from '../domain/index-entry.js';
import type { HybridRetrievedApprovedNote } from '../retrieval/retrieve-approved-notes.js';
import { retrieve_unconfirmed_materials } from '../retrieval/retrieve-unconfirmed-materials.js';
import type { StorageConfig } from '../storage/config.js';
import {
  retrieve_approved_notes,
  retrieve_hybrid_approved_notes,
} from '../retrieval/retrieve-approved-notes.js';
import type { Note } from '../domain/note.js';
import type { WorkflowResult } from './types.js';

const default_top_k = 5;

export type AnswerQuestionWorkflowInput = {
  question: string;
  top_k?: number;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
  llm_client?: LlmClient;
  messages_api?: AnthropicMessagesApi;
  retrieval_mode?: 'default' | 'hybrid';
  metadata_filter?: MetadataFilter;
  include_retrieval_debug?: boolean;
  embedding_provider?: EmbeddingProvider;
  fallback_to_unconfirmed?: boolean;
  answer?: (input: {
    llm_client: LlmClient;
    agent_input: {
      question: string;
      approved_notes: Note[];
      unconfirmed_materials?: UnconfirmedEvidence[];
    };
  }) => Promise<GroundedAnswer>;
};

export type AnswerQuestionWorkflowData = {
  question: string;
  answer: GroundedAnswer;
  matched_note_ids: string[];
  retrieval_results: HybridRetrievalResult[];
  unconfirmed_materials: UnconfirmedEvidence[];
};

export async function answer_question_workflow(
  input: AnswerQuestionWorkflowInput,
): Promise<WorkflowResult<AnswerQuestionWorkflowData>> {
  try {
    const top_k = input.top_k ?? default_top_k;
    const matches =
      input.retrieval_mode === 'hybrid'
        ? await retrieve_hybrid_approved_notes({
            question: input.question,
            top_k,
            storage_config: input.storage_config,
            cwd: input.cwd,
            metadata_filter: input.metadata_filter,
            include_debug: input.include_retrieval_debug,
            embedding_provider: input.embedding_provider,
          })
        : await retrieve_approved_notes({
            question: input.question,
            top_k,
            storage_config: input.storage_config,
            cwd: input.cwd,
          });

    const unconfirmed_materials =
      matches.length === 0 && input.fallback_to_unconfirmed === true
        ? await retrieve_unconfirmed_materials({
            question: input.question,
            enabled: true,
            storage_config: input.storage_config,
            cwd: input.cwd,
          })
        : [];

    if (matches.length === 0 && unconfirmed_materials.length === 0) {
      return {
        ok: true,
        data: {
          question: input.question,
          matched_note_ids: [],
          retrieval_results: [],
          unconfirmed_materials: [],
          answer: {
            conclusion: '没有相关已确认知识。',
            cited_notes: [],
            unconfirmed_materials: [],
            limitations: ['当前知识库没有命中的 approved Note。'],
          },
        },
      };
    }

    const llm_client =
      input.llm_client ?? create_llm_client({}, input.messages_api);
    const answer = input.answer ?? answer_agent;
    const grounded = await answer({
      llm_client,
      agent_input: {
        question: input.question,
        approved_notes: matches.map((item) => item.note),
        unconfirmed_materials,
      },
    });

    return {
      ok: true,
      data: {
        question: input.question,
        matched_note_ids: matches.map((item) => item.note.id),
        retrieval_results: matches
          .filter(
            (item): item is HybridRetrievedApprovedNote => 'retrieval' in item,
          )
          .map((item) => item.retrieval),
        unconfirmed_materials,
        answer: grounded,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'AGENT_FAILED',
        message:
          error instanceof Error ? error.message : 'Failed to answer question.',
        cause: error,
      },
    };
  }
}
