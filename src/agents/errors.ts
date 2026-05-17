export type AgentErrorCode =
  | 'LLM_CALL_FAILED'
  | 'LLM_OUTPUT_PARSE_FAILED'
  | 'LLM_OUTPUT_SCHEMA_FAILED'
  | 'PROMPT_LOAD_FAILED'
  | 'CONTEXT_TOO_LARGE';

export class AgentError extends Error {
  readonly code: AgentErrorCode;
  readonly details?: unknown;

  constructor(input: {
    code: AgentErrorCode;
    message: string;
    details?: unknown;
    cause?: unknown;
  }) {
    super(input.message, { cause: input.cause });
    this.name = 'AgentError';
    this.code = input.code;
    this.details = input.details;
  }
}
