import { run_local_llm_smoke_test } from '../dist/smoke/local-llm-smoke.js';

const keep_workdir = process.argv.includes('--keep-workdir');
const result = await run_local_llm_smoke_test({ keep_workdir });

if (result.status === 'skipped') {
  console.log(result.reason);
  process.exitCode = 0;
} else {
  console.log('Local LLM smoke test passed.');
  console.log(`workdir: ${result.workdir}`);
  for (const path_result of result.paths) {
    console.log(`[${path_result.path}] source_id: ${path_result.source_id}`);
    console.log(`[${path_result.path}] note_id: ${path_result.note_id}`);
    console.log(
      `[${path_result.path}] answer_conclusion: ${path_result.answer_conclusion}`,
    );
  }
}
