import { appendFile, readFile } from 'node:fs/promises';
import { z } from 'zod';
import {
  DiscussionMessageSchema,
  type DiscussionMessage,
} from '../agents/schemas.js';
import type { StorageConfig } from './config.js';
import { StorageError } from './errors.js';
import { source_discussion_path } from './paths.js';

export type DiscussionLogContext = {
  config?: Partial<StorageConfig>;
  cwd?: string;
};

export async function append_discussion_message(
  source_id: string,
  message: DiscussionMessage,
  context: DiscussionLogContext = {},
): Promise<void> {
  const parsed = DiscussionMessageSchema.parse(message);
  try {
    await appendFile(
      source_discussion_path(source_id, context),
      `${JSON.stringify(parsed)}\n`,
      'utf8',
    );
  } catch (error) {
    throw new StorageError({
      code: 'WRITE_FAILED',
      message: `Failed to append discussion message for Source: ${source_id}`,
      path: source_discussion_path(source_id, context),
      cause: error,
    });
  }
}

export async function read_discussion_messages(
  source_id: string,
  context: DiscussionLogContext = {},
): Promise<DiscussionMessage[]> {
  let content: string;
  try {
    content = await readFile(
      source_discussion_path(source_id, context),
      'utf8',
    );
  } catch (error) {
    throw new StorageError({
      code: 'READ_FAILED',
      message: `Failed to read discussion messages for Source: ${source_id}`,
      path: source_discussion_path(source_id, context),
      cause: error,
    });
  }

  const lines = content.split('\n').filter((line) => line.trim().length > 0);
  try {
    return lines.map((line) => DiscussionMessageSchema.parse(JSON.parse(line)));
  } catch (error) {
    throw new StorageError({
      code:
        error instanceof z.ZodError
          ? 'SCHEMA_PARSE_FAILED'
          : 'JSON_PARSE_FAILED',
      message: `Failed to parse discussion messages for Source: ${source_id}`,
      path: source_discussion_path(source_id, context),
      cause: error,
    });
  }
}
