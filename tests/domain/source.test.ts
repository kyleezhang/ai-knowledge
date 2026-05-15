import { describe, expect, it } from 'vitest';
import {
  parse_source,
  validate_source_invariants,
} from '../../src/domain/source.js';
import { transition_source } from '../../src/domain/state-machine.js';
import { create_test_source } from '../source-test-helpers.js';

describe('Source domain', () => {
  it('accepts an initial Markdown user import Source', () => {
    const source = parse_source(create_test_source());

    expect(source.status).toBe('ingested');
    expect(source.ingest_type).toBe('upload_markdown');
    expect(source.content_type).toBe('document');
    expect(source.origin.type).toBe('user_import');
    expect(source.processing_artifacts).toEqual({});
    expect(source.draft_understanding).toBeNull();
    expect(source.discussion_summary.summary_version).toBe(0);
    expect(source.note_ids).toEqual([]);
  });

  it('rejects user_import sources with origin_candidate_id', () => {
    const source = create_test_source({ origin_candidate_id: 'cand_1' });

    expect(() => validate_source_invariants(source)).toThrow(
      'user_import source must not have origin_candidate_id',
    );
  });

  it('does not allow skipping processing before understanding', () => {
    const source = create_test_source();

    expect(() => transition_source(source, 'understanding_ready')).toThrow(
      'Invalid source transition: ingested -> understanding_ready',
    );
  });
});
