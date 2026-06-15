import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type {
  DiscussionAgentOutput,
  DraftUnderstandingCandidate,
  GroundedAnswer,
  NoteCandidate,
} from '../../src/agents/schemas.js';
import type { EmbeddingProvider } from '../../src/agents/embedding-provider.js';
import type { LlmClient } from '../../src/agents/types.js';
import type { AnswerAgentInput } from '../../src/agents/answer-agent.js';
import type { DiscussionAgentInput } from '../../src/agents/discussion-agent.js';
import type { NoteAgentInput } from '../../src/agents/note-agent.js';
import type { UnderstandAgentInput } from '../../src/agents/understand-agent.js';
import { create_program, type CliIo } from '../../src/cli/index.js';
import { read_discussion_messages } from '../../src/storage/discussion-log.js';
import {
  get_index_entry,
  get_vector_index,
} from '../../src/storage/index-repo.js';
import { get_note } from '../../src/storage/note-repo.js';
import {
  index_entry_path,
  knowledge_dir,
  note_json_path,
  note_markdown_path,
  source_discussion_path,
  source_json_path,
  source_processed_dir,
} from '../../src/storage/paths.js';
import { get_source } from '../../src/storage/source-repo.js';
import {
  create_temp_dir,
  write_markdown_fixture,
} from '../source-test-helpers.js';
import { FakeEmbeddingProvider } from '../fake-embedding-provider.js';

const acceptance_fixture_file = new URL(
  '../p0-end-to-end-acceptance.fixture.md',
  import.meta.url,
);
const acceptance_question = 'agent memory boundary approved notes';
const confirmed_point = 'Approved Notes keep the agent memory boundary clear.';
const assistant_reply = 'Approved notes keep raw discussion separate.';
const user_message = 'We should only answer from approved notes.';

describe('P0 end-to-end acceptance CLI', () => {
  it('runs the full P0 flow from an empty knowledge directory and enforces key gates', async () => {
    const cwd = await create_temp_dir();
    const fixture_content = await readFile(acceptance_fixture_file, 'utf8');
    const fixture_path = await write_markdown_fixture(
      cwd,
      'p0-end-to-end-acceptance.fixture.md',
      fixture_content,
    );

    await expect(access(knowledge_dir({ cwd }))).rejects.toBeDefined();

    const ingest_harness = create_cli_harness(cwd);
    await ingest_harness.run([
      'source',
      'ingest',
      'markdown',
      fixture_path,
      '--json',
    ]);
    expect(ingest_harness.exit_code).toBeUndefined();
    const ingest_json = JSON.parse(ingest_harness.stdout[0]) as {
      ok: true;
      data: { source_id: string };
    };
    const source_id = ingest_json.data.source_id;

    const process_harness = create_cli_harness(cwd);
    await process_harness.run(['source', 'process', source_id, '--json']);
    expect(JSON.parse(process_harness.stdout[0])).toMatchObject({
      ok: true,
      data: {
        source: {
          status: 'processed',
          processing_artifacts: {
            clean_text: 'processed/clean_text.md',
            segments: 'processed/segments.json',
            metadata: 'processed/metadata.json',
          },
        },
      },
    });

    const understand_harness = create_cli_harness(cwd, {
      understand: async ({ agent_input }) => ({
        summary: `Summary for ${agent_input.source_title}`,
        key_points: [
          'Approved Notes should be the grounded source of answers.',
        ],
        uncertainties: ['How much context should be carried from discussion?'],
        discussion_starters: ['Why should answers ignore raw discussion?'],
      }),
    });
    await understand_harness.run(['source', 'understand', source_id, '--json']);
    expect(JSON.parse(understand_harness.stdout[0])).toMatchObject({
      ok: true,
      data: {
        source: { status: 'understanding_ready' },
        draft_understanding: {
          summary: 'Summary for Agent Memory Boundary',
        },
      },
    });

    const discuss_harness = create_cli_harness(cwd, {
      repl_input: async_iter([user_message, '/approve', '/exit']),
      discuss: async () => ({
        assistant_message: assistant_reply,
        discussion_summary_update: {
          confirmed_points: [confirmed_point],
          open_questions: [],
          unresolved_issues: [],
          next_prompts: ['Check QA before approving the Note.'],
          ready_for_approval: true,
        },
      }),
    });
    await discuss_harness.run(['source', 'discuss', source_id]);
    const discuss_output = discuss_harness.stdout.join('\n');
    expect(discuss_output).toContain('Source discussion started.');
    expect(discuss_output).toContain(assistant_reply);
    expect(discuss_output).toContain('Source approved for note.');
    expect(discuss_output).toContain(`ai-knowledge note compose ${source_id}`);

    const source_after_discuss = await get_source(source_id, { cwd });
    expect(source_after_discuss.status).toBe('approved_for_note');
    expect(source_after_discuss.discussion_summary.discussion_status).toBe(
      'closed',
    );
    expect(source_after_discuss.discussion_summary.ready_for_approval).toBe(
      true,
    );
    expect(source_after_discuss.discussion_summary.confirmed_points).toEqual([
      confirmed_point,
    ]);

    const compose_harness = create_cli_harness(cwd, {
      compose_note: async ({ agent_input }) =>
        build_acceptance_note_candidate(agent_input),
    });
    await compose_harness.run(['note', 'compose', source_id, '--json']);
    expect(compose_harness.exit_code).toBeUndefined();
    const compose_json = JSON.parse(compose_harness.stdout[0]) as {
      ok: true;
      data: { note_id: string };
    };
    const note_id = compose_json.data.note_id;

    const note_before_lint = await get_note(note_id, { cwd });
    expect(note_before_lint.status).toBe('draft');
    expect(note_before_lint.quality_checks.status).toBe('failed');

    const premature_approve = create_cli_harness(cwd);
    await premature_approve.run(['note', 'approve', note_id]);
    expect(premature_approve.exit_code).toBe(1);
    expect(premature_approve.stderr.join('\n')).toContain(
      'code: INVALID_STATE',
    );

    const lint_harness = create_cli_harness(cwd);
    await lint_harness.run(['note', 'lint', note_id, '--json']);
    expect(JSON.parse(lint_harness.stdout[0])).toMatchObject({
      ok: true,
      data: {
        note_id,
        note: { status: 'draft' },
        lint: { passed: true },
      },
    });

    const approve_note_harness = create_cli_harness(cwd);
    await approve_note_harness.run(['note', 'approve', note_id, '--json']);
    expect(JSON.parse(approve_note_harness.stdout[0])).toMatchObject({
      ok: true,
      data: {
        note_id,
        note: { status: 'approved' },
      },
      next_actions: [{ command: `ai-knowledge note index ${note_id}` }],
    });

    const index_harness = create_cli_harness(cwd);
    await index_harness.run(['note', 'index', note_id, '--json']);
    expect(JSON.parse(index_harness.stdout[0])).toMatchObject({
      ok: true,
      data: {
        index_entry: { note_id, status: 'approved', vector_ref: null },
        vector_index_ref: null,
      },
    });

    const vector_index_harness = create_cli_harness(cwd, {
      embedding_provider: new FakeEmbeddingProvider(),
    });
    await vector_index_harness.run([
      'note',
      'index',
      note_id,
      '--vector',
      '--json',
    ]);
    const vector_index_json = JSON.parse(vector_index_harness.stdout[0]) as {
      ok: true;
      data: { vector_index_ref: { path: string } };
    };
    expect(vector_index_json.data.vector_index_ref.path).toMatch(
      new RegExp(`^\\d{4}/\\d{2}/${note_id}\\.vector\\.json$`),
    );
    await expect(get_vector_index(note_id, { cwd })).resolves.toMatchObject({
      note_id,
      embedding_model: 'fake-embedding',
    });

    const failed_vector_harness = create_cli_harness(cwd, {
      embedding_provider: new FakeEmbeddingProvider(
        new Error('provider failed'),
      ),
    });
    await failed_vector_harness.run(['note', 'index', note_id, '--vector']);
    expect(failed_vector_harness.exit_code).toBe(1);
    expect(failed_vector_harness.stderr.join('\n')).toContain(
      'provider failed',
    );

    const missing_vector_provider_harness = create_cli_harness(cwd);
    const previous_voyage_key = process.env.VOYAGE_API_KEY;
    delete process.env.VOYAGE_API_KEY;
    try {
      await missing_vector_provider_harness.run([
        'note',
        'index',
        note_id,
        '--vector',
      ]);
      expect(missing_vector_provider_harness.exit_code).toBe(1);
      expect(missing_vector_provider_harness.stderr.join('\n')).toContain(
        'Missing API key environment variable: VOYAGE_API_KEY',
      );
    } finally {
      if (previous_voyage_key === undefined) {
        delete process.env.VOYAGE_API_KEY;
      } else {
        process.env.VOYAGE_API_KEY = previous_voyage_key;
      }
    }

    let answer_input: AnswerAgentInput | undefined;
    const answer_harness = create_cli_harness(cwd, {
      answer: async ({ agent_input }) => {
        answer_input = agent_input;
        return {
          conclusion: 'Approved Notes preserve the agent memory boundary.',
          cited_notes: agent_input.approved_notes.map((note) => ({
            note_id: note.id,
            title: note.title,
            relevant_points: note.conclusions,
          })),
          unconfirmed_materials: [],
          limitations: ['P0 keyword retrieval only.'],
        };
      },
    });
    await answer_harness.run(['answer', acceptance_question]);
    const answer_output = answer_harness.stdout.join('\n');
    expect(answer_output).toContain(
      'Approved Notes preserve the agent memory boundary.',
    );
    expect(answer_output).toContain(note_id);
    expect(answer_output).toContain('P0 keyword retrieval only.');
    expect(answer_input?.approved_notes.map((note) => note.id)).toEqual([
      note_id,
    ]);

    const hybrid_answer_harness = create_cli_harness(cwd, {
      answer: async ({ agent_input }) => ({
        conclusion: 'Hybrid retrieval still passes approved Notes.',
        cited_notes: agent_input.approved_notes.map((note) => ({
          note_id: note.id,
          title: note.title,
          relevant_points: note.conclusions,
        })),
        unconfirmed_materials: [],
        limitations: [],
      }),
    });
    const previous_hybrid_voyage_key = process.env.VOYAGE_API_KEY;
    delete process.env.VOYAGE_API_KEY;
    try {
      await hybrid_answer_harness.run([
        'answer',
        acceptance_question,
        '--hybrid',
        '--json',
      ]);
      const hybrid_answer_json = JSON.parse(
        hybrid_answer_harness.stdout[0],
      ) as {
        ok: true;
        data: {
          matched_note_ids: string[];
          retrieval_results: Array<{ note_id: string; debug: string[] }>;
        };
      };
      expect(hybrid_answer_json.data.matched_note_ids).toEqual([note_id]);
      expect(hybrid_answer_json.data.retrieval_results[0].note_id).toBe(
        note_id,
      );
      expect(
        hybrid_answer_json.data.retrieval_results[0].debug.join('\n'),
      ).toContain('Missing API key environment variable: VOYAGE_API_KEY');
    } finally {
      if (previous_hybrid_voyage_key === undefined) {
        delete process.env.VOYAGE_API_KEY;
      } else {
        process.env.VOYAGE_API_KEY = previous_hybrid_voyage_key;
      }
    }

    const fallback_fixture = await write_markdown_fixture(
      cwd,
      'fallback-cli.md',
      `# Fallback CLI\n\nFallback CLI evidence exists only as processed material.\n`,
    );
    const fallback_ingest = create_cli_harness(cwd);
    await fallback_ingest.run([
      'source',
      'ingest',
      'markdown',
      fallback_fixture,
      '--json',
    ]);
    const fallback_source_id = (
      JSON.parse(fallback_ingest.stdout[0]) as {
        ok: true;
        data: { source_id: string };
      }
    ).data.source_id;
    const fallback_process = create_cli_harness(cwd);
    await fallback_process.run([
      'source',
      'process',
      fallback_source_id,
      '--json',
    ]);

    const fallback_json_harness = create_cli_harness(cwd, {
      answer: async ({ agent_input }) => ({
        conclusion: 'Fallback CLI material is unconfirmed.',
        cited_notes: [],
        unconfirmed_materials: agent_input.unconfirmed_materials ?? [],
        limitations: ['Uses unconfirmed material.'],
      }),
    });
    await fallback_json_harness.run([
      'answer',
      'fallback cli evidence',
      '--fallback-unconfirmed',
      '--json',
    ]);
    const fallback_answer_json = JSON.parse(
      fallback_json_harness.stdout[0],
    ) as {
      ok: true;
      data: {
        unconfirmed_materials: Array<{
          material_type: string;
          source_id: string;
          evidence_ref: string;
          limitations: string[];
        }>;
      };
    };
    expect(fallback_answer_json.data.unconfirmed_materials[0]).toMatchObject({
      material_type: 'processed_segment',
      source_id: fallback_source_id,
      evidence_ref: 'processed/segments.json#seg_0001',
    });

    const fallback_text_harness = create_cli_harness(cwd, {
      answer: async ({ agent_input }) => ({
        conclusion: 'Fallback CLI material is unconfirmed.',
        cited_notes: [],
        unconfirmed_materials: agent_input.unconfirmed_materials ?? [],
        limitations: ['Uses unconfirmed material.'],
      }),
    });
    await fallback_text_harness.run([
      'answer',
      'fallback cli evidence',
      '--fallback-unconfirmed',
    ]);
    expect(fallback_text_harness.stdout.join('\n')).toContain(
      'Unconfirmed materials:',
    );
    expect(fallback_text_harness.stdout.join('\n')).toContain(
      '[unconfirmed:processed_segment]',
    );

    await expect(access(knowledge_dir({ cwd }))).resolves.toBeUndefined();
    await expect(
      access(source_json_path(source_id, { cwd })),
    ).resolves.toBeUndefined();
    await expect(
      access(
        path.join(source_processed_dir(source_id, { cwd }), 'clean_text.md'),
      ),
    ).resolves.toBeUndefined();
    await expect(
      access(
        path.join(source_processed_dir(source_id, { cwd }), 'segments.json'),
      ),
    ).resolves.toBeUndefined();
    await expect(
      access(
        path.join(source_processed_dir(source_id, { cwd }), 'metadata.json'),
      ),
    ).resolves.toBeUndefined();
    await expect(
      access(source_discussion_path(source_id, { cwd })),
    ).resolves.toBeUndefined();
    await expect(
      access(note_json_path(note_id, { cwd })),
    ).resolves.toBeUndefined();
    await expect(
      access(note_markdown_path(note_id, { cwd })),
    ).resolves.toBeUndefined();
    await expect(
      access(index_entry_path(note_id, { cwd })),
    ).resolves.toBeUndefined();

    const discussion_messages = await read_discussion_messages(source_id, {
      cwd,
    });
    expect(discussion_messages).toEqual([
      expect.objectContaining({ role: 'user', content: user_message }),
      expect.objectContaining({ role: 'assistant', content: assistant_reply }),
    ]);

    const source = await get_source(source_id, { cwd });
    expect(source.status).toBe('noted');
    expect(source.note_ids).toEqual([note_id]);
    expect(source.discussion_summary.discussion_status).toBe('closed');
    expect(source.discussion_summary.ready_for_approval).toBe(true);

    const note = await get_note(note_id, { cwd });
    expect(note.status).toBe('approved');
    expect(note.quality_checks.status).toBe('passed');
    expect(note.conclusions).toEqual([confirmed_point]);

    const index_entry = await get_index_entry(note_id, { cwd });
    expect(index_entry.status).toBe('approved');
    expect(index_entry.summary).toBe(confirmed_point);
  });
});

function build_acceptance_note_candidate(
  agent_input: NoteAgentInput,
): NoteCandidate {
  return {
    title: 'Agent Memory Boundary',
    conclusions: agent_input.discussion_summary.confirmed_points,
    why_it_matters: ['It keeps raw material and approved knowledge separate.'],
    current_understanding:
      'Only approved Notes are indexed for grounded answers.',
    open_questions: [],
    related_note_ids: [],
    source_refs: agent_input.source_refs,
  };
}

async function* async_iter(items: string[]): AsyncIterable<string> {
  for (const item of items) {
    yield item;
  }
}

function create_cli_harness(
  cwd: string,
  options: {
    understand?: (input: {
      llm_client: LlmClient;
      agent_input: UnderstandAgentInput;
    }) => Promise<DraftUnderstandingCandidate>;
    discuss?: (input: {
      llm_client: LlmClient;
      agent_input: DiscussionAgentInput;
    }) => Promise<DiscussionAgentOutput>;
    compose_note?: (input: {
      llm_client: LlmClient;
      agent_input: NoteAgentInput;
    }) => Promise<NoteCandidate>;
    answer?: (input: {
      llm_client: LlmClient;
      agent_input: AnswerAgentInput;
    }) => Promise<GroundedAnswer>;
    repl_input?: AsyncIterable<string>;
    embedding_provider?: EmbeddingProvider;
  } = {},
): {
  stdout: string[];
  stderr: string[];
  exit_code: number | undefined;
  run: (args: string[]) => Promise<void>;
} {
  const stdout: string[] = [];
  const stderr: string[] = [];
  let exit_code: number | undefined;
  const io: CliIo = {
    stdout: (message) => stdout.push(message),
    stderr: (message) => stderr.push(message),
    set_exit_code: (code) => {
      exit_code = code;
    },
  };

  return {
    stdout,
    stderr,
    get exit_code() {
      return exit_code;
    },
    run: async (args) => {
      await create_program({
        io,
        cwd,
        understand: options.understand,
        discuss: options.discuss,
        compose_note: options.compose_note,
        answer: options.answer,
        repl_input: options.repl_input,
        embedding_provider: options.embedding_provider,
      }).parseAsync(['node', 'ai-knowledge', ...args]);
    },
  };
}
