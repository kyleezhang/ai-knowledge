import { init_storage, type InitStorageResult } from '../storage/init.js';
import type { StorageConfig } from '../storage/config.js';
import type { WorkflowResult } from './types.js';

export type InitWorkflowInput = {
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
};

export type InitWorkflowData = InitStorageResult;

export async function init_workflow(
  input: InitWorkflowInput = {},
): Promise<WorkflowResult<InitWorkflowData>> {
  try {
    const data = await init_storage({
      config: input.storage_config,
      cwd: input.cwd,
    });

    return {
      ok: true,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'STORAGE_FAILED',
        message: 'Failed to initialize knowledge storage.',
        cause: error,
      },
    };
  }
}
