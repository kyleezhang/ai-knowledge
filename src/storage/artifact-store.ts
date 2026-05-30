import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { Source } from '../domain/source.js';
import type { StorageConfig } from './config.js';
import { StorageError } from './errors.js';
import {
  source_dir,
  source_processed_dir,
  source_raw_html_path,
  source_raw_markdown_path,
  source_raw_pdf_path,
} from './paths.js';

export type ArtifactStoreContext = {
  config?: Partial<StorageConfig>;
  cwd?: string;
};

export type ProcessedArtifactPaths = {
  clean_text: string;
  segments: string;
  metadata: string;
};

export const PROCESSED_SEGMENTS_ARTIFACT_PATH = 'processed/segments.json';

export const ProcessedSegmentLocatorSchema = z.object({
  ref: z.string(),
  source_kind: z.enum(['markdown', 'pdf', 'url', 'feishu_doc']),
  position: z.number().int().positive(),
  page: z.number().int().positive().optional(),
  heading_path: z.array(z.string()),
  section: z.string().optional(),
});

export const ProcessedSegmentSchema = z
  .object({
    id: z.string(),
    order: z.number().int().positive(),
    heading_path: z.array(z.string()),
    text: z.string(),
    locator: ProcessedSegmentLocatorSchema,
  })
  .superRefine((segment, ctx) => {
    if (segment.locator.ref !== build_evidence_locator_ref(segment.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['locator', 'ref'],
        message: 'locator.ref must match processed segment id',
      });
    }
    if (segment.locator.position !== segment.order) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['locator', 'position'],
        message: 'locator.position must match segment order',
      });
    }
    if (!arrays_equal(segment.locator.heading_path, segment.heading_path)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['locator', 'heading_path'],
        message: 'locator.heading_path must match segment heading_path',
      });
    }
  });

export const EvidenceLocatorRefSchema = z
  .string()
  .regex(
    /^processed\/segments\.json#seg_\d{4}$/u,
    'evidence ref must use processed/segments.json#<segment_id>',
  );

export type EvidenceLocatorRef = z.infer<typeof EvidenceLocatorRefSchema>;

export function build_evidence_locator_ref(
  segment_id: string,
): EvidenceLocatorRef {
  return EvidenceLocatorRefSchema.parse(
    `${PROCESSED_SEGMENTS_ARTIFACT_PATH}#${segment_id}`,
  );
}

export function parse_evidence_locator_ref(ref: string): {
  artifact_path: typeof PROCESSED_SEGMENTS_ARTIFACT_PATH;
  segment_id: string;
} {
  const parsed = EvidenceLocatorRefSchema.safeParse(ref);
  if (!parsed.success) {
    throw new Error(
      'evidence ref must use processed/segments.json#<segment_id>',
    );
  }

  return {
    artifact_path: PROCESSED_SEGMENTS_ARTIFACT_PATH,
    segment_id: parsed.data.slice(
      `${PROCESSED_SEGMENTS_ARTIFACT_PATH}#`.length,
    ),
  };
}

export function is_evidence_locator_ref(
  ref: string,
): ref is EvidenceLocatorRef {
  return EvidenceLocatorRefSchema.safeParse(ref).success;
}

export function evidence_locator_refs_from_segments(
  segments: ProcessedSegment[],
): EvidenceLocatorRef[] {
  return segments.map((segment) => segment.locator.ref);
}

export function evidence_locator_ref_exists(
  segments: ProcessedSegment[],
  ref: string,
): boolean {
  if (!is_evidence_locator_ref(ref)) {
    return false;
  }
  const { segment_id } = parse_evidence_locator_ref(ref);
  return segments.some(
    (segment) => segment.id === segment_id || segment.locator.ref === ref,
  );
}

function arrays_equal(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((item, index) => item === right[index])
  );
}

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
  page_count: z.number().int().positive().optional(),
  source_url: z.string().optional(),
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
    return await readFile(source_raw_markdown_path(source_id, context), 'utf8');
  } catch (error) {
    throw new StorageError({
      code: 'READ_FAILED',
      message: `Failed to read raw original Markdown for Source: ${source_id}`,
      path: source_raw_markdown_path(source_id, context),
      cause: error,
    });
  }
}

export async function read_raw_original_pdf(
  source_id: string,
  context: ArtifactStoreContext = {},
): Promise<Uint8Array> {
  try {
    return await readFile(source_raw_pdf_path(source_id, context));
  } catch (error) {
    throw new StorageError({
      code: 'READ_FAILED',
      message: `Failed to read raw original PDF for Source: ${source_id}`,
      path: source_raw_pdf_path(source_id, context),
      cause: error,
    });
  }
}

export async function read_raw_fetched_html(
  source_id: string,
  context: ArtifactStoreContext = {},
): Promise<string> {
  try {
    return await readFile(source_raw_html_path(source_id, context), 'utf8');
  } catch (error) {
    throw new StorageError({
      code: 'READ_FAILED',
      message: `Failed to read fetched HTML for Source: ${source_id}`,
      path: source_raw_html_path(source_id, context),
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
    segments: PROCESSED_SEGMENTS_ARTIFACT_PATH,
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
      z.array(ProcessedSegmentSchema).parse(input.segments),
      context,
    );
    await write_json_artifact(
      input.source.id,
      artifacts.metadata,
      ProcessedMetadataSchema.parse(input.metadata),
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
