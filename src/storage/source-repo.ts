import { access, cp, mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  SourceSchema,
  SourceStatusSchema,
  parse_source,
  type Source,
  type SourceStatus,
} from '../domain/source.js';
import type { StorageConfig } from './config.js';
import { StorageError } from './errors.js';
import { read_json, write_json } from './json-store.js';
import {
  source_dir,
  source_discussion_path,
  source_json_path,
  source_processed_dir,
  source_raw_dir,
  source_raw_file_name_for_ingest_type,
  source_raw_path,
  sources_root,
} from './paths.js';

export type SourceListFilter = {
  status?: SourceStatus;
};

export type SourceRepoContext = {
  config?: Partial<StorageConfig>;
  cwd?: string;
};

export type CreateSourceRawArtifactInput = {
  file_name: string;
  file_path?: string;
  content?: string | Uint8Array;
};

export type CreateSourceInput = {
  source: Source;
  raw_file_name?: string;
  raw_file_path?: string;
  raw_content?: string | Uint8Array;
  raw_artifacts?: CreateSourceRawArtifactInput[];
};

export async function create_source(
  input: CreateSourceInput,
  context: SourceRepoContext = {},
): Promise<Source> {
  const source = parse_source(input.source);
  const dir = source_dir(source.id, context);

  if (await exists(dir)) {
    throw new StorageError({
      code: 'ALREADY_EXISTS',
      message: `Source already exists: ${source.id}`,
      path: dir,
    });
  }

  const raw_artifacts = normalize_raw_artifacts(input, source.ingest_type);
  for (const artifact of raw_artifacts) {
    validate_raw_artifact_input(artifact);
  }

  await mkdir(source_raw_dir(source.id, context), { recursive: true });
  await mkdir(source_processed_dir(source.id, context), { recursive: true });

  for (const artifact of raw_artifacts) {
    const raw_target_path = source_raw_path(
      source.id,
      artifact.file_name,
      context,
    );
    if (artifact.file_path !== undefined) {
      await cp(artifact.file_path, raw_target_path);
    } else {
      await write_raw_content(raw_target_path, artifact.content!);
    }
  }

  await writeFile(source_discussion_path(source.id, context), '', 'utf8');
  await write_json({
    file_path: source_json_path(source.id, context),
    schema: SourceSchema,
    data: source,
  });

  return source;
}

export async function get_source(
  source_id: string,
  context: SourceRepoContext = {},
): Promise<Source> {
  const primary_path = source_json_path(source_id, context);
  if (await exists(primary_path)) {
    return parse_source(
      await read_json({ file_path: primary_path, schema: SourceSchema }),
    );
  }

  const fallback_path = await find_source_json(source_id, context);
  if (fallback_path === null) {
    throw new StorageError({
      code: 'NOT_FOUND',
      message: `Source not found: ${source_id}`,
      path: primary_path,
    });
  }

  return parse_source(
    await read_json({ file_path: fallback_path, schema: SourceSchema }),
  );
}

export async function save_source(
  source: Source,
  context: SourceRepoContext = {},
): Promise<void> {
  const parsed_source = parse_source(source);
  await write_json({
    file_path: source_json_path(parsed_source.id, context),
    schema: SourceSchema,
    data: parsed_source,
  });
}

export async function list_sources(
  filter: SourceListFilter = {},
  context: SourceRepoContext = {},
): Promise<Source[]> {
  if (filter.status !== undefined) {
    SourceStatusSchema.parse(filter.status);
  }

  const root = sources_root(context);
  if (!(await exists(root))) {
    return [];
  }

  const files = await find_source_json_files(root);
  const sources = await Promise.all(
    files.map(async (file_path) =>
      parse_source(await read_json({ file_path, schema: SourceSchema })),
    ),
  );

  return sources
    .filter(
      (source) =>
        filter.status === undefined || source.status === filter.status,
    )
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at));
}

function normalize_raw_artifacts(
  input: CreateSourceInput,
  ingest_type: Source['ingest_type'],
): CreateSourceRawArtifactInput[] {
  if (input.raw_artifacts !== undefined) {
    if (
      input.raw_file_name !== undefined ||
      input.raw_file_path !== undefined ||
      input.raw_content !== undefined
    ) {
      throw new StorageError({
        code: 'WRITE_FAILED',
        message:
          'CreateSourceInput cannot mix raw_artifacts with legacy raw input fields.',
      });
    }

    if (input.raw_artifacts.length === 0) {
      throw new StorageError({
        code: 'WRITE_FAILED',
        message: 'CreateSourceInput.raw_artifacts must not be empty.',
      });
    }

    return input.raw_artifacts;
  }

  return [
    {
      file_name:
        input.raw_file_name ??
        source_raw_file_name_for_ingest_type(ingest_type),
      file_path: input.raw_file_path,
      content: input.raw_content,
    },
  ];
}

function validate_raw_artifact_input(
  artifact: CreateSourceRawArtifactInput,
): void {
  if (path.basename(artifact.file_name) !== artifact.file_name) {
    throw new StorageError({
      code: 'INVALID_PATH',
      message: `Invalid raw file name: ${artifact.file_name}`,
    });
  }

  if (artifact.file_path !== undefined && artifact.content !== undefined) {
    throw new StorageError({
      code: 'WRITE_FAILED',
      message:
        'CreateSource raw artifact cannot provide both file_path and content.',
    });
  }

  if (artifact.file_path === undefined && artifact.content === undefined) {
    throw new StorageError({
      code: 'WRITE_FAILED',
      message: 'CreateSource raw artifact must provide file_path or content.',
    });
  }
}

async function write_raw_content(
  raw_target_path: string,
  raw_content: string | Uint8Array,
): Promise<void> {
  if (typeof raw_content === 'string') {
    await writeFile(raw_target_path, raw_content, 'utf8');
    return;
  }

  await writeFile(raw_target_path, raw_content);
}

async function exists(file_path: string): Promise<boolean> {
  try {
    await access(file_path);
    return true;
  } catch {
    return false;
  }
}

async function find_source_json(
  source_id: string,
  context: SourceRepoContext,
): Promise<string | null> {
  const files = await find_source_json_files(sources_root(context));
  return (
    files.find(
      (file_path) => path.basename(path.dirname(file_path)) === source_id,
    ) ?? null
  );
}

async function find_source_json_files(root: string): Promise<string[]> {
  if (!(await exists(root))) {
    return [];
  }

  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entry_path = path.join(root, entry.name);
      if (entry.isDirectory()) {
        return find_source_json_files(entry_path);
      }
      return entry.name === 'source.json' ? [entry_path] : [];
    }),
  );

  return nested.flat();
}
