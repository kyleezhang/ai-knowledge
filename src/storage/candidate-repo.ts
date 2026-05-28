import { access, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import {
  CandidateSchema,
  CandidateStatusSchema,
  parse_candidate,
  type Candidate,
  type CandidateStatus,
} from '../domain/candidate.js';
import type { StorageConfig } from './config.js';
import { StorageError } from './errors.js';
import { read_json, write_json } from './json-store.js';
import { candidate_json_path, candidates_root } from './paths.js';

export type CandidateRepoContext = {
  config?: Partial<StorageConfig>;
  cwd?: string;
};

export type CandidateListFilter = {
  status?: CandidateStatus;
};

export async function create_candidate(
  candidate: Candidate,
  context: CandidateRepoContext = {},
): Promise<Candidate> {
  const parsed_candidate = parse_candidate(candidate);
  const file_path = candidate_json_path(parsed_candidate.id, context);
  if (await exists(file_path)) {
    throw new StorageError({
      code: 'ALREADY_EXISTS',
      message: `Candidate already exists: ${parsed_candidate.id}`,
      path: file_path,
    });
  }

  await mkdir(path.dirname(file_path), { recursive: true });
  await write_json({
    file_path,
    schema: CandidateSchema,
    data: parsed_candidate,
  });
  return parsed_candidate;
}

export async function get_candidate(
  candidate_id: string,
  context: CandidateRepoContext = {},
): Promise<Candidate> {
  const primary_path = candidate_json_path(candidate_id, context);
  if (await exists(primary_path)) {
    return parse_candidate(
      await read_json({ file_path: primary_path, schema: CandidateSchema }),
    );
  }

  const fallback_path = await find_candidate_json(candidate_id, context);
  if (fallback_path === null) {
    throw new StorageError({
      code: 'NOT_FOUND',
      message: `Candidate not found: ${candidate_id}`,
      path: primary_path,
    });
  }

  return parse_candidate(
    await read_json({ file_path: fallback_path, schema: CandidateSchema }),
  );
}

export async function list_candidates(
  filter: CandidateListFilter = {},
  context: CandidateRepoContext = {},
): Promise<Candidate[]> {
  if (filter.status !== undefined) {
    CandidateStatusSchema.parse(filter.status);
  }

  const root = candidates_root(context);
  if (!(await exists(root))) {
    return [];
  }

  const files = await find_candidate_json_files(root);
  const candidates = await Promise.all(
    files.map(async (file_path) =>
      parse_candidate(await read_json({ file_path, schema: CandidateSchema })),
    ),
  );

  return candidates
    .filter(
      (candidate) =>
        filter.status === undefined || candidate.status === filter.status,
    )
    .sort((left, right) => right.collected_at.localeCompare(left.collected_at));
}

async function exists(file_path: string): Promise<boolean> {
  try {
    await access(file_path);
    return true;
  } catch {
    return false;
  }
}

async function find_candidate_json(
  candidate_id: string,
  context: CandidateRepoContext,
): Promise<string | null> {
  const files = await find_candidate_json_files(candidates_root(context));
  return (
    files.find(
      (file_path) => path.basename(file_path) === `${candidate_id}.json`,
    ) ?? null
  );
}

async function find_candidate_json_files(root: string): Promise<string[]> {
  if (!(await exists(root))) {
    return [];
  }

  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entry_path = path.join(root, entry.name);
      if (entry.isDirectory()) {
        return find_candidate_json_files(entry_path);
      }
      return entry.name.endsWith('.json') ? [entry_path] : [];
    }),
  );

  return nested.flat();
}
