import { describe, expect, it } from 'vitest';
import {
  __test_only__,
  run_local_llm_smoke_test,
} from '../../src/smoke/local-llm-smoke.js';

describe('local LLM smoke test', () => {
  it('skips without DEEPSEEK_API_KEY and does not fail', async () => {
    const result = await run_local_llm_smoke_test({
      env: { ...process.env, DEEPSEEK_API_KEY: '' },
    });

    expect(result).toEqual({
      status: 'skipped',
      reason: 'Missing DEEPSEEK_API_KEY. Local smoke test was skipped.',
    });
  });

  it('defines one unified smoke path list for Markdown, PDF, and URL', () => {
    expect(__test_only__.smoke_paths).toEqual(['markdown', 'pdf', 'url']);
  });

  it('extracts the answer conclusion from CLI output', () => {
    const output = [
      '## 综合结论',
      'Approved Notes preserve the agent memory boundary.',
      '## 依据的已确认笔记',
    ].join('\n');

    expect(__test_only__.extract_answer_conclusion(output)).toBe(
      'Approved Notes preserve the agent memory boundary.',
    );
  });

  it('formats path-scoped command failures with debugging ids', () => {
    expect(
      __test_only__.format_smoke_command_error({
        path_label: 'pdf',
        args: ['source', 'process', 'src_20260526_upload_pdf_smoke'],
        workdir: '/tmp/ai-knowledge-smoke',
        source_id: 'src_20260526_upload_pdf_smoke',
        note_id: 'note_20260526_pdf-smoke',
        stderr: ['code: PROCESSING_FAILED'],
        stdout: ['Source failed.'],
      }),
    ).toContain('Path failed: pdf');
  });
});
