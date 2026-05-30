import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec_file = promisify(execFile);

export type FeishuDocReadResult = {
  title: string;
  document_type: string;
  markdown: string;
  raw_snapshot: unknown;
};

export type FeishuDocReader = (input: {
  doc_url_or_token: string;
}) => Promise<FeishuDocReadResult>;

export async function read_feishu_doc_with_lark_cli(input: {
  doc_url_or_token: string;
}): Promise<FeishuDocReadResult> {
  const { stdout } = await exec_file(
    'lark-cli',
    [
      'docs',
      '+fetch',
      input.doc_url_or_token,
      '--api-version',
      'v2',
      '--format',
      'markdown',
      '--json',
    ],
    { maxBuffer: 10 * 1024 * 1024 },
  );

  return parse_lark_cli_doc_output(input.doc_url_or_token, stdout);
}

function parse_lark_cli_doc_output(
  original_input: string,
  stdout: string,
): FeishuDocReadResult {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) {
    throw new Error('Feishu Doc reader returned empty output.');
  }

  try {
    const value = JSON.parse(trimmed) as Record<string, unknown>;
    const data = object_value(value.data) ?? value;
    const markdown = string_value(data.markdown) ?? string_value(data.content);
    if (markdown === undefined) {
      throw new Error('Feishu Doc reader output does not include Markdown.');
    }

    return {
      title:
        string_value(data.title) ??
        string_value(data.name) ??
        string_value(value.title) ??
        original_input,
      document_type:
        string_value(data.document_type) ??
        string_value(data.type) ??
        string_value(value.document_type) ??
        'docx',
      markdown,
      raw_snapshot: value,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        title: original_input,
        document_type: 'docx',
        markdown: stdout,
        raw_snapshot: { original_input, markdown: stdout },
      };
    }
    throw error;
  }
}

function object_value(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function string_value(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
