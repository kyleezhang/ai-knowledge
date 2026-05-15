export type StorageErrorCode =
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'INVALID_PATH'
  | 'READ_FAILED'
  | 'WRITE_FAILED'
  | 'JSON_PARSE_FAILED'
  | 'SCHEMA_PARSE_FAILED';

export class StorageError extends Error {
  readonly code: StorageErrorCode;
  readonly path?: string;
  readonly details?: unknown;

  constructor(input: {
    code: StorageErrorCode;
    message: string;
    path?: string;
    details?: unknown;
    cause?: unknown;
  }) {
    super(input.message, { cause: input.cause });
    this.name = 'StorageError';
    this.code = input.code;
    this.path = input.path;
    this.details = input.details;
  }
}
