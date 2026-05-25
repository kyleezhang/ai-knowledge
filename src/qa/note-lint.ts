import type { Note } from '../domain/note.js';
import {
  evidence_locator_ref_exists,
  is_evidence_locator_ref,
  type ProcessedSegment,
} from '../storage/artifact-store.js';

export const required_note_markdown_sections = [
  '## 来源概览',
  '## 为什么值得关注',
  '## 讨论后的结论',
  '## 当前理解',
  '## 未解决问题',
  '## 相关笔记',
  '## 来源链接',
];

export type NoteLintResult = {
  passed: boolean;
  failures: string[];
  quality_checks: Note['quality_checks'];
};

export function note_lint(input: {
  note: Note;
  markdown: string;
  checked_at: string;
  source_segments?: ProcessedSegment[];
}): NoteLintResult {
  const failures = [
    ...required_field_failures(input.note, input.source_segments),
    ...markdown_failures(input.markdown),
  ];
  const empty_sections = required_note_markdown_sections.filter(
    (section) => !input.markdown.includes(section),
  );
  const passed = failures.length === 0;

  return {
    passed,
    failures,
    quality_checks: {
      status: passed ? 'passed' : 'failed',
      template_complete: empty_sections.length === 0,
      source_links_present: input.note.source_refs.length > 0,
      empty_sections,
      last_checked_at: input.checked_at,
    },
  };
}

function required_field_failures(
  note: Note,
  source_segments?: ProcessedSegment[],
): string[] {
  const failures: string[] = [];
  if (note.source_refs.length === 0) {
    failures.push('source_refs is required');
  }
  for (const source_ref of note.source_refs) {
    if (source_ref.evidence_refs.length === 0) {
      failures.push('source_refs.evidence_refs is required');
      continue;
    }
    for (const evidence_ref of source_ref.evidence_refs) {
      if (!is_evidence_locator_ref(evidence_ref)) {
        failures.push(
          `invalid evidence_ref: ${evidence_ref} must use processed/segments.json#<segment_id>`,
        );
        continue;
      }
      if (
        source_segments !== undefined &&
        !evidence_locator_ref_exists(source_segments, evidence_ref)
      ) {
        failures.push(
          `evidence_ref does not exist in processed segments: ${evidence_ref}`,
        );
      }
    }
  }
  if (note.conclusions.length === 0) {
    failures.push('conclusions is required');
  }
  if (note.why_it_matters.length === 0) {
    failures.push('why_it_matters is required');
  }
  if (note.approval_context.source_id.trim().length === 0) {
    failures.push('approval_context.source_id is required');
  }
  if (note.approval_context.approved_from_summary_version < 1) {
    failures.push('approval_context.approved_from_summary_version is required');
  }
  return failures;
}

function markdown_failures(markdown: string): string[] {
  return required_note_markdown_sections
    .filter((section) => !markdown.includes(section))
    .map((section) => `missing markdown section: ${section}`);
}
