import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { Source } from '../domain/source.js';
import type { StorageConfig } from './config.js';
import { StorageError } from './errors.js';
import { source_dir, source_processed_dir, source_raw_path } from './paths.js';

export type ArtifactStoreContext = {
  config?: Partial<StorageConfig>;
  cwd?: string;
};

export type ProcessedArtifactPaths = {
  clean_text: string;
  segments: string;
  metadata: string;
};

export const ProcessedSegmentSchema = z.object({
  id: z.string(),
  order: z.number().int().positive(),
  heading_path: z.array(z.string()),
  text: z.string(),
});

export const ProcessedMetadataSchema = z.object({
  title: z.string(),
  headings: z.array(
    z.object({
      level: z.number().int().positive(),
      title: z.string(),
    }),
  ),
  links: z.array(
    z.object({
      text: z.string(),
      url: z.string(),
    }),
  ),
  segment_count: z.number().int().nonnegative(),
  processed_at: z.string(),
});

export type ProcessedSegment = z.infer<typeof ProcessedSegmentSchema>;
export type ProcessedMetadata = z.infer<typeof ProcessedMetadataSchema>;

export type ProcessedArtifacts = {
  clean_text: string;
  segments: ProcessedSegment[];
  metadata: ProcessedMetadata;
};

export async function read_raw_original_markdown(
  source_id: string,
  context: ArtifactStoreContext = {},
): Promise<string> {
  try {
    return await readFile(source_raw_path(source_id, context), 'utf8');
  } catch (error) {
    throw new StorageError({
      code: 'READ_FAILED',
      message: `Failed to read raw original Markdown for Source: ${source_id}`,
      path: source_raw_path(source_id, context),
      cause: error,
    });
  }
}

export async function read_processed_artifacts(
  source: Source,
  context: ArtifactStoreContext = {},
): Promise<ProcessedArtifacts> {
  try {
    const clean_text = await readFile(
      resolve_artifact_path(
        source.id,
        source.processing_artifacts.clean_text,
        context,
      ),
      'utf8',
    );
    const segments = z
      .array(ProcessedSegmentSchema)
      .parse(
        JSON.parse(
          await readFile(
            resolve_artifact_path(
              source.id,
              source.processing_artifacts.segments,
              context,
            ),
            'utf8',
          ),
        ),
      );
    const metadata = ProcessedMetadataSchema.parse(
      JSON.parse(
        await readFile(
          resolve_artifact_path(
            source.id,
            source.processing_artifacts.metadata,
            context,
          ),
          'utf8',
        ),
      ),
    );

    return { clean_text, segments, metadata };
  } catch (error) {
    throw new StorageError({
      code: error instanceof StorageError ? error.code : 'READ_FAILED',
      message: `Failed to read processed artifacts for Source: ${source.id}`,
      cause: error,
    });
  }
}

export async function write_processed_artifacts(
  input: {
    source: Source;
    clean_text: string;
    segments: unknown;
    metadata: unknown;
  },
  context: ArtifactStoreContext = {},
): Promise<ProcessedArtifactPaths> {
  const artifacts: ProcessedArtifactPaths = {
    clean_text: 'processed/clean_text.md',
    segments: 'processed/segments.json',
    metadata: 'processed/metadata.json',
  };

  try {
    await mkdir(source_processed_dir(input.source.id, context), {
      recursive: true,
    });
    await write_text_artifact(
      input.source.id,
      artifacts.clean_text,
      input.clean_text,
      context,
    );
    await write_json_artifact(
      input.source.id,
      artifacts.segments,
      input.segments,
      context,
    );
    await write_json_artifact(
      input.source.id,
      artifacts.metadata,
      input.metadata,
      context,
    );
  } catch (error) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError({
      code: 'WRITE_FAILED',
      message: `Failed to write processed artifacts for Source: ${input.source.id}`,
      cause: error,
    });
  }

  return artifacts;
}

async function write_text_artifact(
  source_id: string,
  relative_path: string,
  content: string,
  context: ArtifactStoreContext,
): Promise<void> {
  await writeFile(
    resolve_artifact_path(source_id, relative_path, context),
    content,
    'utf8',
  );
}

async function write_json_artifact(
  source_id: string,
  relative_path: string,
  content: unknown,
  context: ArtifactStoreContext,
): Promise<void> {
  await writeFile(
    resolve_artifact_path(source_id, relative_path, context),
    `${JSON.stringify(content, null, 2)}\n`,
    'utf8',
  );
}

function resolve_artifact_path(
  source_id: string,
  relative_path: string,
  context: ArtifactStoreContext,
): string {
  if (
    path.isAbsolute(relative_path) ||
    relative_path.split(path.sep).includes('..')
  ) {
    throw new StorageError({
      code: 'INVALID_PATH',
      message: `Invalid artifact path: ${relative_path}`,
    });
  }

  const dir = source_dir(source_id, context);
  const resolved = path.resolve(dir, relative_path);
  const root = path.resolve(dir);

  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new StorageError({
      code: 'INVALID_PATH',
      message: `Artifact path escapes Source directory: ${relative_path}`,
      path: resolved,
    });
  }

  return resolved;
}
