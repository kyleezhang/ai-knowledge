import { run_local_llm_smoke_test } from '../dist/smoke/local-llm-smoke.js';

const keep_workdir = process.argv.includes('--keep-workdir');
const result = await run_local_llm_smoke_test({ keep_workdir });

if (result.status === 'skipped') {
  console.log(result.reason);
  process.exitCode = 0;
} else {
  console.log('Local LLM smoke test passed.');
  if (result.workdir !== undefined) {
    console.log(`workdir: ${result.workdir}`);
  }
  if (result.source_id !== undefined) {
    console.log(`source_id: ${result.source_id}`);
  }
  if (result.note_id !== undefined) {
    console.log(`note_id: ${result.note_id}`);
  }
  if (result.answer_conclusion !== undefined) {
    console.log(`answer_conclusion: ${result.answer_conclusion}`);
  }
}
