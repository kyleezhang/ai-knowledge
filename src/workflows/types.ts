export type NextAction = {
  label: string;
  command: string;
};

export type WorkflowResult<T> =
  | {
      ok: true;
      data: T;
      next_actions?: NextAction[];
    }
  | {
      ok: false;
      error: WorkflowError;
      next_actions?: NextAction[];
    };

export type WorkflowError = {
  code: WorkflowErrorCode;
  message: string;
  details?: unknown;
  cause?: unknown;
};

export type WorkflowErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'INVALID_STATE'
  | 'PROCESSING_FAILED'
  | 'AGENT_FAILED'
  | 'QA_FAILED'
  | 'STORAGE_FAILED'
  | 'PARTIAL_FAILURE'
  | 'UNKNOWN';
