import type { EmbeddingProvider } from '../agents/embedding-provider.js';
import { ConfiguredEmbeddingProvider } from '../agents/embedding-provider.js';
import type {
  HybridRetrievalOptions,
  HybridRetrievalResult,
  HybridRetrievalSignal,
  IndexEntry,
  MetadataFilter,
  VectorIndex,
} from '../domain/index-entry.js';
import { parse_hybrid_retrieval_result } from '../domain/index-entry.js';
import type { Note } from '../domain/note.js';
import type { StorageConfig } from '../storage/config.js';
import { get_vector_index, list_index_entries } from '../storage/index-repo.js';
import { get_note } from '../storage/note-repo.js';

export const default_related_context_limit = 5;
export const default_related_per_direct_note_limit = 2;

export type RelatedExpansionOptions = {
  related_context_limit?: number;
  related_per_direct_note_limit?: number;
  include_debug?: boolean;
};

export type RetrievedApprovedNote = {
  entry: IndexEntry;
  note: Note;
  score: number;
  retrieval?: HybridRetrievalResult;
};

export type RelatedExpansionDebug = {
  messages: string[];
};

export type RelatedExpansionResult = {
  results: RetrievedApprovedNote[];
  debug: RelatedExpansionDebug;
};

export type RetrieveApprovedNotesInput = {
  question: string;
  top_k: number;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
} & RelatedExpansionOptions;

export type HybridRetrievedApprovedNote = RetrievedApprovedNote & {
  retrieval: HybridRetrievalResult;
};

export type RetrieveHybridApprovedNotesInput = {
  question: string;
  top_k: number;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
  metadata_filter?: MetadataFilter;
  weights?: HybridRetrievalOptions['weights'];
  embedding_provider?: EmbeddingProvider;
} & RelatedExpansionOptions;

const default_hybrid_weights = {
  keyword: 0.4,
  metadata: 0.2,
  vector: 0.4,
} satisfies NonNullable<HybridRetrievalOptions['weights']>;

export async function retrieve_approved_notes(
  input: RetrieveApprovedNotesInput,
): Promise<RetrievedApprovedNote[]> {
  const context = { config: input.storage_config, cwd: input.cwd };
  const terms = tokenize(input.question);
  const entries = await list_index_entries(context);
  const scored = entries
    .filter((entry) => entry.status === 'approved')
    .map((entry) => ({ entry, score: score_entry(entry, terms) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, input.top_k);

  const loaded = await Promise.all(
    scored.map(async (item) => {
      try {
        const note = await get_note(item.entry.note_id, context);
        return note.status === 'approved'
          ? {
              ...item,
              note,
              retrieval: direct_retrieval_result({
                entry: item.entry,
                score: item.score,
                include_debug: input.include_debug,
              }),
            }
          : null;
      } catch {
        return null;
      }
    }),
  );

  const direct: RetrievedApprovedNote[] = loaded.filter(
    (item): item is NonNullable<(typeof loaded)[number]> => item !== null,
  );
  return (
    await expand_related_approved_notes({
      direct,
      context,
      related_context_limit: input.related_context_limit,
      related_per_direct_note_limit: input.related_per_direct_note_limit,
      include_debug: input.include_debug,
    })
  ).results;
}

function score_entry(entry: IndexEntry, terms: string[]): number {
  const haystack = [
    entry.title,
    entry.summary,
    ...entry.keywords,
    ...entry.tags,
  ]
    .join(' ')
    .toLowerCase();
  return terms.reduce(
    (score, term) => score + (haystack.includes(term) ? 1 : 0),
    0,
  );
}

function tokenize(input: string): string[] {
  return Array.from(
    new Set(
      input
        .toLowerCase()
        .split(/[^\p{L}\p{N}_-]+/u)
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  );
}

export async function retrieve_hybrid_approved_notes(
  input: RetrieveHybridApprovedNotesInput,
): Promise<HybridRetrievedApprovedNote[]> {
  const context = { config: input.storage_config, cwd: input.cwd };
  const terms = tokenize(input.question);
  const entries = (await list_index_entries(context))
    .filter((entry) => entry.status === 'approved')
    .filter((entry) => matches_metadata_filter(entry, input.metadata_filter));
  const query_embedding = await generate_query_embedding(input);
  const weighted = await Promise.all(
    entries.map(async (entry) => {
      const signals = build_non_vector_signals(
        entry,
        terms,
        input.metadata_filter,
      );
      const debug: string[] = [];
      const vector_signal = await build_vector_signal({
        entry,
        query_embedding,
        context,
        debug,
      });
      if (vector_signal !== null) {
        signals.push(vector_signal);
      }

      if (signals.length === 0) {
        return null;
      }

      const final_score = calculate_final_score(
        signals,
        input.weights ?? default_hybrid_weights,
      );
      const retrieval = parse_hybrid_retrieval_result({
        note_id: entry.note_id,
        final_score,
        signals,
        debug: input.include_debug === true ? debug : [],
      });
      return { entry, retrieval };
    }),
  );
  const candidates = weighted.filter(
    (item): item is { entry: IndexEntry; retrieval: HybridRetrievalResult } =>
      item !== null,
  );
  candidates.sort((left, right) => {
    if (right.retrieval.final_score !== left.retrieval.final_score) {
      return right.retrieval.final_score - left.retrieval.final_score;
    }
    const approved_order = right.entry.approved_at.localeCompare(
      left.entry.approved_at,
    );
    if (approved_order !== 0) {
      return approved_order;
    }
    return left.entry.note_id.localeCompare(right.entry.note_id);
  });

  const loaded = await Promise.all(
    candidates.slice(0, input.top_k).map(async (item) => {
      try {
        const note = await get_note(item.entry.note_id, context);
        return note.status === 'approved'
          ? {
              entry: item.entry,
              note,
              score: item.retrieval.final_score,
              retrieval: parse_hybrid_retrieval_result({
                ...item.retrieval,
                retrieval_role: 'direct',
              }),
            }
          : null;
      } catch {
        return null;
      }
    }),
  );

  const direct = loaded.filter(
    (item): item is HybridRetrievedApprovedNote => item !== null,
  );
  return (
    await expand_related_approved_notes({
      direct,
      context,
      related_context_limit: input.related_context_limit,
      related_per_direct_note_limit: input.related_per_direct_note_limit,
      include_debug: input.include_debug,
    })
  ).results as HybridRetrievedApprovedNote[];
}

export async function expand_related_approved_notes(input: {
  direct: RetrievedApprovedNote[];
  context: { config?: Partial<StorageConfig>; cwd?: string };
  related_context_limit?: number;
  related_per_direct_note_limit?: number;
  include_debug?: boolean;
}): Promise<RelatedExpansionResult> {
  const total_limit =
    input.related_context_limit ?? default_related_context_limit;
  const per_direct_limit =
    input.related_per_direct_note_limit ??
    default_related_per_direct_note_limit;
  const debug: string[] = [];
  const direct_ids = new Set(input.direct.map((item) => item.note.id));
  const seen_related_ids = new Set<string>();
  const related: RetrievedApprovedNote[] = [];

  if (total_limit <= 0 || per_direct_limit <= 0) {
    debug.push('related expansion skipped: related limit is zero');
    return { results: input.direct, debug: { messages: debug } };
  }

  for (const direct of input.direct) {
    const direct_related_note_ids = new Set([
      ...direct.note.related_note_ids,
      ...direct.entry.related_note_ids,
    ]);
    let added_for_direct = 0;
    let truncated_for_direct = 0;
    for (const related_note_id of direct_related_note_ids) {
      if (added_for_direct >= per_direct_limit) {
        truncated_for_direct += 1;
        continue;
      }
      if (related.length >= total_limit) {
        debug.push(
          `related expansion truncated: total limit ${total_limit} reached`,
        );
        return append_related_debug({
          direct: input.direct,
          related,
          debug,
          include_debug: input.include_debug,
        });
      }
      if (direct_ids.has(related_note_id)) {
        debug.push(
          `related skipped: ${related_note_id} is already a direct match`,
        );
        continue;
      }
      if (seen_related_ids.has(related_note_id)) {
        debug.push(`related skipped: ${related_note_id} is duplicate`);
        continue;
      }

      try {
        const note = await get_note(related_note_id, input.context);
        if (note.status !== 'approved') {
          debug.push(
            `related skipped: ${related_note_id} status is ${note.status}`,
          );
          continue;
        }
        const entry = await find_index_entry_for_note(note, input.context);
        const retrieval = parse_hybrid_retrieval_result({
          note_id: note.id,
          final_score: 0,
          retrieval_role: 'related',
          related_via_note_id: direct.note.id,
          related_via_title: direct.note.title,
          signals: [
            {
              type: 'metadata',
              score: 1,
              normalized_score: 0,
              explanation: `related via ${direct.note.id}`,
            },
          ],
          debug:
            input.include_debug === true
              ? [`related via ${direct.note.id}`]
              : [],
        });
        related.push({ entry, note, score: 0, retrieval });
        seen_related_ids.add(note.id);
        added_for_direct += 1;
      } catch {
        debug.push(`related skipped: ${related_note_id} could not be loaded`);
      }
    }
    if (truncated_for_direct > 0) {
      debug.push(
        `related expansion truncated: ${truncated_for_direct} related notes skipped for ${direct.note.id} by per-direct limit ${per_direct_limit}`,
      );
    }
  }

  return append_related_debug({
    direct: input.direct,
    related,
    debug,
    include_debug: input.include_debug,
  });
}

function append_related_debug(input: {
  direct: RetrievedApprovedNote[];
  related: RetrievedApprovedNote[];
  debug: string[];
  include_debug?: boolean;
}): RelatedExpansionResult {
  if (input.include_debug === true && input.debug.length > 0) {
    for (const item of [...input.direct, ...input.related]) {
      if (item.retrieval !== undefined) {
        item.retrieval.debug.push(...input.debug);
      }
    }
  }
  return {
    results: [...input.direct, ...input.related],
    debug: { messages: input.debug },
  };
}

async function find_index_entry_for_note(
  note: Note,
  context: { config?: Partial<StorageConfig>; cwd?: string },
): Promise<IndexEntry> {
  const entries = await list_index_entries(context);
  const entry = entries.find((item) => item.note_id === note.id);
  if (entry !== undefined) {
    return entry;
  }
  return {
    note_id: note.id,
    title: note.title,
    summary: note.conclusions[0] ?? note.current_understanding,
    keywords: [],
    tags: [],
    status: 'approved',
    approved_at: note.approved_at ?? note.updated_at,
    related_note_ids: note.related_note_ids,
    vector_ref: null,
  };
}

function direct_retrieval_result(input: {
  entry: IndexEntry;
  score: number;
  include_debug?: boolean;
}): HybridRetrievalResult {
  return parse_hybrid_retrieval_result({
    note_id: input.entry.note_id,
    final_score: input.score,
    retrieval_role: 'direct',
    signals: [
      {
        type: 'keyword',
        score: input.score,
        normalized_score: Math.min(1, input.score),
        explanation: 'matched keyword retrieval',
      },
    ],
    debug: input.include_debug === true ? [] : [],
  });
}

function build_non_vector_signals(
  entry: IndexEntry,
  terms: string[],
  metadata_filter: MetadataFilter | undefined,
): HybridRetrievalSignal[] {
  const signals: HybridRetrievalSignal[] = [];
  const keyword = score_keyword_signal(entry, terms);
  if (keyword !== null) {
    signals.push(keyword);
  }
  const metadata = score_metadata_signal(entry, metadata_filter);
  if (metadata !== null) {
    signals.push(metadata);
  }
  return signals;
}

function score_keyword_signal(
  entry: IndexEntry,
  terms: string[],
): HybridRetrievalSignal | null {
  if (terms.length === 0) {
    return null;
  }
  const fields = [
    ['title', entry.title],
    ['summary', entry.summary],
    ['keywords', entry.keywords.join(' ')],
    ['tags', entry.tags.join(' ')],
  ] as const;
  const matches: string[] = [];
  for (const term of terms) {
    for (const [field, value] of fields) {
      if (value.toLowerCase().includes(term)) {
        matches.push(`${field}:${term}`);
        break;
      }
    }
  }
  if (matches.length === 0) {
    return null;
  }
  return {
    type: 'keyword',
    score: matches.length,
    normalized_score: matches.length / terms.length,
    explanation: `matched ${matches.join(', ')}`,
  };
}

function score_metadata_signal(
  entry: IndexEntry,
  metadata_filter: MetadataFilter | undefined,
): HybridRetrievalSignal | null {
  const matches: string[] = [];
  for (const tag of metadata_filter?.boost_tags ?? []) {
    if (entry.tags.includes(tag)) {
      matches.push(`tag:${tag}`);
    }
  }
  for (const keyword of metadata_filter?.boost_keywords ?? []) {
    if (entry.keywords.includes(keyword)) {
      matches.push(`keyword:${keyword}`);
    }
  }
  if (metadata_filter?.related_note_ids !== undefined) {
    for (const note_id of metadata_filter.related_note_ids) {
      if (entry.related_note_ids.includes(note_id)) {
        matches.push(`related_note_id:${note_id}`);
      }
    }
  }
  if (matches.length === 0) {
    return null;
  }
  const requested =
    (metadata_filter?.boost_tags?.length ?? 0) +
    (metadata_filter?.boost_keywords?.length ?? 0) +
    (metadata_filter?.related_note_ids?.length ?? 0);
  return {
    type: 'metadata',
    score: matches.length,
    normalized_score: requested === 0 ? 1 : matches.length / requested,
    explanation: `matched ${matches.join(', ')}`,
  };
}

function matches_metadata_filter(
  entry: IndexEntry,
  filter: MetadataFilter | undefined,
): boolean {
  if (filter === undefined) {
    return true;
  }
  if (
    filter.tags !== undefined &&
    !filter.tags.every((tag) => entry.tags.includes(tag))
  ) {
    return false;
  }
  if (
    filter.keywords !== undefined &&
    !filter.keywords.every((keyword) => entry.keywords.includes(keyword))
  ) {
    return false;
  }
  if (
    filter.related_note_ids !== undefined &&
    !filter.related_note_ids.every((note_id) =>
      entry.related_note_ids.includes(note_id),
    )
  ) {
    return false;
  }
  if (
    filter.approved_at_from !== undefined &&
    entry.approved_at < filter.approved_at_from
  ) {
    return false;
  }
  if (
    filter.approved_at_to !== undefined &&
    entry.approved_at > filter.approved_at_to
  ) {
    return false;
  }
  return true;
}

async function generate_query_embedding(
  input: RetrieveHybridApprovedNotesInput,
): Promise<{
  embedding: number[];
  dimensions: number;
  unavailable_reason: string | null;
}> {
  try {
    const provider =
      input.embedding_provider ?? new ConfiguredEmbeddingProvider();
    const result = await provider.generate_embeddings({
      texts: [input.question],
      input_type: 'query',
    });
    if (result.embeddings.length !== 1) {
      return {
        embedding: [],
        dimensions: 0,
        unavailable_reason: 'query embedding count mismatch',
      };
    }
    return {
      embedding: result.embeddings[0],
      dimensions: result.embedding_dimensions,
      unavailable_reason: null,
    };
  } catch (error) {
    return {
      embedding: [],
      dimensions: 0,
      unavailable_reason:
        error instanceof Error ? error.message : 'query embedding failed',
    };
  }
}

async function build_vector_signal(input: {
  entry: IndexEntry;
  query_embedding: {
    embedding: number[];
    dimensions: number;
    unavailable_reason: string | null;
  };
  context: { config?: Partial<StorageConfig>; cwd?: string };
  debug: string[];
}): Promise<HybridRetrievalSignal | null> {
  if (input.entry.vector_ref === null) {
    input.debug.push('vector unavailable: no vector_ref');
    return null;
  }
  if (input.query_embedding.unavailable_reason !== null) {
    input.debug.push(
      `vector unavailable: ${input.query_embedding.unavailable_reason}`,
    );
    return null;
  }
  let vector_index: VectorIndex;
  try {
    vector_index = await get_vector_index(input.entry.note_id, input.context);
  } catch {
    input.debug.push('vector unavailable: vector index not found');
    return null;
  }
  if (vector_index.embedding_dimensions !== input.query_embedding.dimensions) {
    input.debug.push('vector unavailable: embedding dimensions mismatch');
    return null;
  }
  const scores = vector_index.chunks.map((chunk) => ({
    chunk_id: chunk.chunk_id,
    score: cosine_similarity(input.query_embedding.embedding, chunk.embedding),
  }));
  const best = scores.sort((left, right) => right.score - left.score)[0];
  if (best === undefined || best.score <= 0) {
    return null;
  }
  return {
    type: 'vector',
    score: best.score,
    normalized_score: Math.max(0, Math.min(1, best.score)),
    explanation: `best chunk ${best.chunk_id}`,
  };
}

function calculate_final_score(
  signals: HybridRetrievalSignal[],
  weights: NonNullable<HybridRetrievalOptions['weights']>,
): number {
  return signals.reduce(
    (score, signal) => score + signal.normalized_score * weights[signal.type],
    0,
  );
}

function cosine_similarity(left: number[], right: number[]): number {
  if (left.length !== right.length || left.length === 0) {
    return 0;
  }
  const dot = left.reduce((sum, value, index) => sum + value * right[index], 0);
  const left_norm = Math.sqrt(
    left.reduce((sum, value) => sum + value * value, 0),
  );
  const right_norm = Math.sqrt(
    right.reduce((sum, value) => sum + value * value, 0),
  );
  if (left_norm === 0 || right_norm === 0) {
    return 0;
  }
  return dot / (left_norm * right_norm);
}
