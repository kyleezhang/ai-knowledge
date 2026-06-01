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

  it('accepts a Feishu Doc user import Source with metadata', () => {
    const source = parse_source(
      create_test_source({
        id: 'src_20260514_feishu_doc_test-doc',
        ingest_type: 'feishu_doc',
        origin: {
          type: 'user_import',
          candidate_id: null,
          user_input_type: 'feishu_doc',
        },
        metadata: {
          feishu_doc: {
            original_input: 'https://example.feishu.cn/docx/test',
            title: 'Test Doc',
            document_type: 'docx',
            imported_at: '2026-05-14T00:00:00.000Z',
          },
        },
      }),
    );

    expect(source.status).toBe('ingested');
    expect(source.ingest_type).toBe('feishu_doc');
    expect(source.content_type).toBe('document');
    expect(source.origin.user_input_type).toBe('feishu_doc');
    expect(source.metadata?.feishu_doc?.title).toBe('Test Doc');
  });

  it('rejects a Feishu Doc Source without metadata', () => {
    const source = create_test_source({
      id: 'src_20260514_feishu_doc_test-doc',
      ingest_type: 'feishu_doc',
      origin: {
        type: 'user_import',
        candidate_id: null,
        user_input_type: 'feishu_doc',
      },
    });

    expect(() => validate_source_invariants(source)).toThrow(
      'feishu_doc source must have metadata.feishu_doc',
    );
  });

  it('rejects a Feishu Doc Source with the wrong user input type', () => {
    expect(() =>
      parse_source(
        create_test_source({
          id: 'src_20260514_feishu_doc_test-doc',
          ingest_type: 'feishu_doc',
          origin: {
            type: 'user_import',
            candidate_id: null,
            user_input_type: 'lark_doc',
          },
          metadata: {
            feishu_doc: {
              original_input: 'token',
              title: 'Test Doc',
              document_type: 'docx',
              imported_at: '2026-05-14T00:00:00.000Z',
            },
          },
        }),
      ),
    ).toThrow(
      'feishu_doc source must have origin.user_input_type = feishu_doc',
    );
  });

  it('rejects user_import sources with origin_candidate_id', () => {
    const source = create_test_source({ origin_candidate_id: 'cand_1' });

    expect(() => validate_source_invariants(source)).toThrow(
      'user_import source must not have origin_candidate_id',
    );
  });

  it('accepts a PDF user import Source', () => {
    const source = parse_source(
      create_test_source({
        id: 'src_20260514_upload_pdf_test-source',
        ingest_type: 'upload_pdf',
        origin: {
          type: 'user_import',
          candidate_id: null,
          user_input_type: 'pdf',
        },
      }),
    );

    expect(source.ingest_type).toBe('upload_pdf');
    expect(source.origin.user_input_type).toBe('pdf');
    expect(source.url).toBeNull();
  });

  it('accepts a URL user import Source with a non-null url', () => {
    const source = parse_source(
      create_test_source({
        id: 'src_20260514_input_url_example-com-article',
        ingest_type: 'input_url',
        content_type: 'link',
        origin: {
          type: 'user_import',
          candidate_id: null,
          user_input_type: 'url',
        },
        url: 'https://example.com/article',
      }),
    );

    expect(source.ingest_type).toBe('input_url');
    expect(source.content_type).toBe('link');
    expect(source.url).toBe('https://example.com/article');
  });

  it('rejects a URL Source without a url', () => {
    const source = create_test_source({
      id: 'src_20260514_input_url_example-com-article',
      ingest_type: 'input_url',
      content_type: 'link',
      origin: {
        type: 'user_import',
        candidate_id: null,
        user_input_type: 'url',
      },
      url: null,
    });

    expect(() => validate_source_invariants(source)).toThrow(
      'input_url source must have a non-null url',
    );
  });

  it('does not allow skipping processing before understanding', () => {
    const source = create_test_source();

    expect(() => transition_source(source, 'understanding_ready')).toThrow(
      'Invalid source transition: ingested -> understanding_ready',
    );
  });

  it('allows archiving non-processing Sources without requiring processed artifacts', () => {
    const ingested = create_test_source();
    const failed = create_test_source({
      status: 'failed',
      last_error: {
        stage: 'processing',
        message: 'Failed.',
        occurred_at: '2026-05-14T00:00:00.000Z',
      },
    });

    expect(transition_source(ingested, 'archived').status).toBe('archived');
    expect(transition_source(failed, 'archived').status).toBe('archived');
    expect(() =>
      validate_source_invariants({ ...ingested, status: 'archived' }),
    ).not.toThrow();
  });

  it('rejects archiving processing or already archived Sources', () => {
    expect(() =>
      transition_source(
        create_test_source({ status: 'processing' }),
        'archived',
      ),
    ).toThrow('Invalid source transition: processing -> archived');
    expect(() =>
      transition_source(create_test_source({ status: 'archived' }), 'archived'),
    ).toThrow('Invalid source transition: archived -> archived');
  });

  it('requires standard artifacts for processed sources', () => {
    const source = create_test_source({
      status: 'processed',
      processing_artifacts: {
        clean_text: 'processed/clean_text.md',
      },
    });

    expect(() => validate_source_invariants(source)).toThrow(
      'processed source must have standard processing_artifacts',
    );
  });

  it('accepts processed sources with standard artifacts', () => {
    const source = create_test_source({
      status: 'processed',
      processing_artifacts: {
        clean_text: 'processed/clean_text.md',
        segments: 'processed/segments.json',
        metadata: 'processed/metadata.json',
      },
    });

    expect(() => validate_source_invariants(source)).not.toThrow();
  });

  it('requires last_error for failed sources', () => {
    const source = create_test_source({ status: 'failed' });

    expect(() => validate_source_invariants(source)).toThrow(
      'failed source must have last_error',
    );
  });

  it('allows discussing to approved_for_note transition', () => {
    const source = create_test_source({
      status: 'discussing',
      processing_artifacts: {
        clean_text: 'processed/clean_text.md',
        segments: 'processed/segments.json',
        metadata: 'processed/metadata.json',
      },
      draft_understanding: {
        summary: 'Summary',
        key_points: ['Point'],
        uncertainties: [],
        discussion_starters: [],
        generated_at: '2026-05-14T00:00:00.000Z',
      },
      discussion_summary: {
        ...create_test_source().discussion_summary,
        ready_for_approval: true,
        confirmed_points: ['Confirmed'],
      },
    });

    expect(transition_source(source, 'approved_for_note').status).toBe(
      'approved_for_note',
    );
  });

  it('allows approved_for_note without model-ready suggestion when blockers are absent', () => {
    const source = create_test_source({
      status: 'approved_for_note',
      processing_artifacts: {
        clean_text: 'processed/clean_text.md',
        segments: 'processed/segments.json',
        metadata: 'processed/metadata.json',
      },
      draft_understanding: {
        summary: 'Summary',
        key_points: ['Point'],
        uncertainties: [],
        discussion_starters: [],
        generated_at: '2026-05-14T00:00:00.000Z',
      },
      discussion_summary: {
        ...create_test_source().discussion_summary,
        discussion_status: 'closed',
        ready_for_approval: false,
        confirmed_points: ['Confirmed'],
        open_questions: [],
        unresolved_issues: [],
      },
    });

    expect(() => validate_source_invariants(source)).not.toThrow();
  });

  it('allows approved_for_note with preserved advisory blockers after explicit approval', () => {
    const source = create_test_source({
      status: 'approved_for_note',
      processing_artifacts: {
        clean_text: 'processed/clean_text.md',
        segments: 'processed/segments.json',
        metadata: 'processed/metadata.json',
      },
      draft_understanding: {
        summary: 'Summary',
        key_points: ['Point'],
        uncertainties: [],
        discussion_starters: [],
        generated_at: '2026-05-14T00:00:00.000Z',
      },
      discussion_summary: {
        ...create_test_source().discussion_summary,
        discussion_status: 'closed',
        ready_for_approval: false,
        confirmed_points: ['Confirmed'],
        open_questions: ['Question'],
        unresolved_issues: ['Issue'],
      },
    });

    expect(() => validate_source_invariants(source)).not.toThrow();
  });

  it('rejects approved_for_note when discussion is not closed', () => {
    const source = create_test_source({
      status: 'approved_for_note',
      processing_artifacts: {
        clean_text: 'processed/clean_text.md',
        segments: 'processed/segments.json',
        metadata: 'processed/metadata.json',
      },
      draft_understanding: {
        summary: 'Summary',
        key_points: ['Point'],
        uncertainties: [],
        discussion_starters: [],
        generated_at: '2026-05-14T00:00:00.000Z',
      },
      discussion_summary: {
        ...create_test_source().discussion_summary,
        discussion_status: 'open',
        ready_for_approval: true,
        confirmed_points: ['Confirmed'],
      },
    });

    expect(() => validate_source_invariants(source)).toThrow(
      'approved_for_note source must have closed discussion',
    );
  });

  it('rejects approved_for_note when confirmed points are missing', () => {
    const source = create_test_source({
      status: 'approved_for_note',
      processing_artifacts: {
        clean_text: 'processed/clean_text.md',
        segments: 'processed/segments.json',
        metadata: 'processed/metadata.json',
      },
      draft_understanding: {
        summary: 'Summary',
        key_points: ['Point'],
        uncertainties: [],
        discussion_starters: [],
        generated_at: '2026-05-14T00:00:00.000Z',
      },
      discussion_summary: {
        ...create_test_source().discussion_summary,
        discussion_status: 'closed',
        ready_for_approval: true,
        confirmed_points: [],
      },
    });

    expect(() => validate_source_invariants(source)).toThrow(
      'ready discussion must have confirmed_points',
    );
  });

  it('rejects approved_for_note without confirmed points', () => {
    const source = create_test_source({
      status: 'approved_for_note',
      processing_artifacts: {
        clean_text: 'processed/clean_text.md',
        segments: 'processed/segments.json',
        metadata: 'processed/metadata.json',
      },
      draft_understanding: {
        summary: 'Summary',
        key_points: ['Point'],
        uncertainties: [],
        discussion_starters: [],
        generated_at: '2026-05-14T00:00:00.000Z',
      },
      discussion_summary: {
        ...create_test_source().discussion_summary,
        ready_for_approval: true,
        confirmed_points: [],
      },
    });

    expect(() => validate_source_invariants(source)).toThrow(
      'ready discussion must have confirmed_points',
    );
  });
});
