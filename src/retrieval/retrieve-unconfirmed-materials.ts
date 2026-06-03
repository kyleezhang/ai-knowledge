import type { UnconfirmedEvidence } from '../domain/index-entry.js';
import { parse_unconfirmed_evidence } from '../domain/index-entry.js';
import type { Source } from '../domain/source.js';
import type { StorageConfig } from '../storage/config.js';
import { read_processed_artifacts } from '../storage/artifact-store.js';
import { list_sources } from '../storage/source-repo.js';

const default_max_items = 5;
const default_max_excerpt_length = 500;

export type RetrieveUnconfirmedMaterialsInput = {
  question: string;
  enabled: boolean;
  max_items?: number;
  max_excerpt_length?: number;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
};

export async function retrieve_unconfirmed_materials(
  input: RetrieveUnconfirmedMaterialsInput,
): Promise<UnconfirmedEvidence[]> {
  if (!input.enabled) {
    return [];
  }

  const context = { config: input.storage_config, cwd: input.cwd };
  const terms = tokenize(input.question);
  const sources = await list_sources({}, context);
  const evidence: UnconfirmedEvidence[] = [];
  for (const source of sources) {
    evidence.push(
      ...(await evidence_from_processed_artifacts(
        source,
        terms,
        input,
        context,
      )),
      ...evidence_from_draft_understanding(source, terms, input),
      ...evidence_from_discussion_summary(source, terms, input),
    );
  }

  return evidence.slice(0, input.max_items ?? default_max_items);
}

async function evidence_from_processed_artifacts(
  source: Source,
  terms: string[],
  input: RetrieveUnconfirmedMaterialsInput,
  context: { config?: Partial<StorageConfig>; cwd?: string },
): Promise<UnconfirmedEvidence[]> {
  if (Object.keys(source.processing_artifacts).length === 0) {
    return [];
  }

  try {
    const artifacts = await read_processed_artifacts(source, context);
    const segment_evidence = artifacts.segments
      .filter((segment) => matches_terms(segment.text, terms))
      .map((segment) =>
        build_evidence({
          source,
          material_type: 'processed_segment',
          evidence_ref: `processed/segments.json#${segment.id}`,
          excerpt: excerpt(segment.text, input.max_excerpt_length),
          limitation: 'Processed segment has not become approved knowledge.',
        }),
      );

    if (segment_evidence.length > 0) {
      return segment_evidence;
    }

    if (matches_terms(artifacts.clean_text, terms)) {
      return [
        build_evidence({
          source,
          material_type: 'processed_text',
          evidence_ref: 'processed/clean_text.md',
          excerpt: excerpt(artifacts.clean_text, input.max_excerpt_length),
          limitation: 'Processed text has not become approved knowledge.',
        }),
      ];
    }
  } catch {
    return [];
  }

  return [];
}

function evidence_from_draft_understanding(
  source: Source,
  terms: string[],
  input: RetrieveUnconfirmedMaterialsInput,
): UnconfirmedEvidence[] {
  if (source.draft_understanding === null) {
    return [];
  }
  const text = [
    source.draft_understanding.summary,
    ...source.draft_understanding.key_points,
    ...source.draft_understanding.uncertainties,
  ].join('\n');
  if (!matches_terms(text, terms)) {
    return [];
  }
  return [
    build_evidence({
      source,
      material_type: 'draft_understanding',
      evidence_ref: 'source.json#draft_understanding',
      excerpt: excerpt(text, input.max_excerpt_length),
      limitation:
        'Draft understanding has not been approved as formal knowledge.',
    }),
  ];
}

function evidence_from_discussion_summary(
  source: Source,
  terms: string[],
  input: RetrieveUnconfirmedMaterialsInput,
): UnconfirmedEvidence[] {
  const summary = source.discussion_summary;
  const text = [
    ...summary.confirmed_points,
    ...summary.open_questions,
    ...summary.unresolved_issues,
    ...summary.next_prompts,
  ].join('\n');
  if (text.trim().length === 0 || !matches_terms(text, terms)) {
    return [];
  }
  return [
    build_evidence({
      source,
      material_type: 'discussion_summary',
      evidence_ref: 'source.json#discussion_summary',
      excerpt: excerpt(text, input.max_excerpt_length),
      limitation: 'Discussion summary has not been approved into a Note.',
    }),
  ];
}

function build_evidence(input: {
  source: Source;
  material_type: UnconfirmedEvidence['material_type'];
  evidence_ref: string;
  excerpt: string;
  limitation: string;
}): UnconfirmedEvidence {
  return parse_unconfirmed_evidence({
    confirmation_status: 'unconfirmed',
    material_type: input.material_type,
    source_id: input.source.id,
    source_title: input.source.title,
    source_status: input.source.status,
    evidence_ref: input.evidence_ref,
    excerpt: input.excerpt,
    limitations: [input.limitation],
  });
}

function excerpt(
  text: string,
  max_length = default_max_excerpt_length,
): string {
  const normalized = text.replace(/\s+/gu, ' ').trim();
  return normalized.length <= max_length
    ? normalized
    : normalized.slice(0, max_length).trimEnd();
}

function matches_terms(text: string, terms: string[]): boolean {
  if (terms.length === 0) {
    return false;
  }
  const lower = text.toLowerCase();
  return terms.some((term) => lower.includes(term));
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
