import type { Source } from './source.js';

export type DiscussionConvergenceFailureReason =
  | 'source_not_discussing'
  | 'ready_for_approval_false'
  | 'missing_confirmed_points'
  | 'open_questions_present'
  | 'unresolved_issues_present';

export type DiscussionConvergenceCheckResult =
  | {
      passed: true;
      reasons: [];
    }
  | {
      passed: false;
      reasons: DiscussionConvergenceFailureReason[];
    };

export function check_discussion_convergence(
  source: Source,
): DiscussionConvergenceCheckResult {
  const reasons: DiscussionConvergenceFailureReason[] = [];
  const summary = source.discussion_summary;

  if (source.status !== 'discussing') {
    reasons.push('source_not_discussing');
  }

  if (!summary.ready_for_approval) {
    reasons.push('ready_for_approval_false');
  }

  if (summary.confirmed_points.length === 0) {
    reasons.push('missing_confirmed_points');
  }

  if (summary.open_questions.length > 0) {
    reasons.push('open_questions_present');
  }

  if (summary.unresolved_issues.length > 0) {
    reasons.push('unresolved_issues_present');
  }

  return reasons.length === 0
    ? { passed: true, reasons: [] }
    : { passed: false, reasons };
}

export function format_discussion_convergence_failure_reason(
  reason: DiscussionConvergenceFailureReason,
): string {
  switch (reason) {
    case 'source_not_discussing':
      return 'Source is not in discussing status.';
    case 'ready_for_approval_false':
      return 'Discussion summary is not marked ready_for_approval.';
    case 'missing_confirmed_points':
      return 'Discussion is missing confirmed_points.';
    case 'open_questions_present':
      return 'Discussion still has open_questions.';
    case 'unresolved_issues_present':
      return 'Discussion still has unresolved_issues.';
  }
}

export function format_discussion_convergence_failure_reasons(
  reasons: DiscussionConvergenceFailureReason[],
): string[] {
  return reasons.map(format_discussion_convergence_failure_reason);
}
