import type { EmbeddingProvider } from '../agents/embedding-provider.js';
import type { LlmClient } from '../agents/types.js';
import type { LocalTask } from '../domain/local-task.js';
import type { StorageConfig } from '../storage/config.js';
import { index_note_workflow } from './index-note-workflow.js';
import { lint_note_workflow } from './lint-note-workflow.js';
import { process_source_workflow } from './process-source-workflow.js';
import { render_note_workflow } from './render-note-workflow.js';
import { understand_source_workflow } from './understand-source-workflow.js';
import type { WorkflowResult } from './types.js';

export type LocalTaskRunnerInput = {
  task: LocalTask;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
  llm_client?: LlmClient;
  embedding_provider?: EmbeddingProvider;
};

export async function run_local_task_payload(
  input: LocalTaskRunnerInput,
): Promise<WorkflowResult<{ result_ref: string; result_summary: string }>> {
  const common = { storage_config: input.storage_config, cwd: input.cwd };
  switch (input.task.payload.type) {
    case 'source.process': {
      const result = await process_source_workflow({
        ...common,
        source_id: input.task.payload.input.source_id,
      });
      return map_result(result, `source:${input.task.payload.input.source_id}`);
    }
    case 'source.understand': {
      const result = await understand_source_workflow({
        ...common,
        source_id: input.task.payload.input.source_id,
        llm_client: input.llm_client,
      });
      return map_result(result, `source:${input.task.payload.input.source_id}`);
    }
    case 'note.render': {
      const result = await render_note_workflow({
        ...common,
        note_id: input.task.payload.input.note_id,
      });
      return map_result(
        result,
        `note:${input.task.payload.input.note_id}:render`,
      );
    }
    case 'note.lint': {
      const result = await lint_note_workflow({
        ...common,
        note_id: input.task.payload.input.note_id,
      });
      return map_result(
        result,
        `note:${input.task.payload.input.note_id}:lint`,
      );
    }
    case 'note.index': {
      const result = await index_note_workflow({
        ...common,
        note_id: input.task.payload.input.note_id,
      });
      return map_result(result, `note:${input.task.payload.input.note_id}`);
    }
    case 'note.vector_index': {
      const result = await index_note_workflow({
        ...common,
        note_id: input.task.payload.input.note_id,
        include_vector: true,
        embedding_provider: input.embedding_provider,
      });
      return map_result(
        result,
        `note:${input.task.payload.input.note_id}:vector`,
      );
    }
  }
}

function map_result<T>(
  result: WorkflowResult<T>,
  result_ref: string,
): WorkflowResult<{ result_ref: string; result_summary: string }> {
  if (!result.ok) {
    return result;
  }
  return {
    ok: true,
    data: {
      result_ref,
      result_summary: 'workflow succeeded',
    },
  };
}
