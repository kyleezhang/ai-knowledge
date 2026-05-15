import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { z } from 'zod';
import { StorageError } from './errors.js';

export async function read_json<T>(input: {
  file_path: string;
  schema: z.ZodType<T>;
}): Promise<T> {
  let raw: string;
  try {
    raw = await readFile(input.file_path, 'utf8');
  } catch (error) {
    throw new StorageError({
      code: 'READ_FAILED',
      message: `Failed to read JSON: ${input.file_path}`,
      path: input.file_path,
      cause: error,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new StorageError({
      code: 'JSON_PARSE_FAILED',
      message: `Failed to parse JSON: ${input.file_path}`,
      path: input.file_path,
      cause: error,
    });
  }

  try {
    return input.schema.parse(parsed);
  } catch (error) {
    throw new StorageError({
      code: 'SCHEMA_PARSE_FAILED',
      message: `JSON schema validation failed: ${input.file_path}`,
      path: input.file_path,
      cause: error,
    });
  }
}

export async function write_json<T>(input: {
  file_path: string;
  schema: z.ZodType<T>;
  data: T;
}): Promise<void> {
  let parsed: T;
  try {
    parsed = input.schema.parse(input.data);
  } catch (error) {
    throw new StorageError({
      code: 'SCHEMA_PARSE_FAILED',
      message: `JSON schema validation failed before write: ${input.file_path}`,
      path: input.file_path,
      cause: error,
    });
  }

  const temp_path = path.join(
    path.dirname(input.file_path),
    `.${path.basename(input.file_path)}.${process.pid}.tmp`,
  );

  try {
    await writeFile(temp_path, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
    await rename(temp_path, input.file_path);
  } catch (error) {
    await rm(temp_path, { force: true });
    throw new StorageError({
      code: 'WRITE_FAILED',
      message: `Failed to write JSON: ${input.file_path}`,
      path: input.file_path,
      cause: error,
    });
  }
}
