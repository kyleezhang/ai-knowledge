import { create_slug } from '../domain/slug.js';
import type { Source } from '../domain/source.js';
import type { StorageConfig } from '../storage/config.js';
import { StorageError } from '../storage/errors.js';
import { create_source } from '../storage/source-repo.js';
import { summarize_source, type SourceSummary } from './source-summary.js';
import type { WorkflowResult } from './types.js';
import {
  build_user_import_source,
  create_available_source_id,
  next_actions_for_source,
} from './ingest-source-helpers.js';

export type IngestUrlWorkflowInput = {
  url: string;
  storage_config?: Partial<StorageConfig>;
  cwd?: string;
  now?: Date;
  fetch_html?: (url: string) => Promise<string>;
};

export type IngestUrlWorkflowData = {
  source_id: string;
  source: SourceSummary;
};

export async function ingest_url_workflow(
  input: IngestUrlWorkflowInput,
): Promise<WorkflowResult<IngestUrlWorkflowData>> {
  let parsed_url: URL;
  try {
    parsed_url = new URL(input.url);
  } catch (error) {
    return invalid_input('URL import requires a valid absolute URL.', error);
  }

  if (!is_public_http_url(parsed_url)) {
    return invalid_input(
      'URL import only supports explicit public http(s) URLs.',
    );
  }

  const fetch_html = input.fetch_html ?? fetch_public_html;
  let raw_html: string;
  try {
    raw_html = await fetch_html(parsed_url.href);
  } catch (error) {
    return invalid_input(
      'URL import failed because the page could not be fetched as a public single-page document.',
      error,
    );
  }

  if (raw_html.trim().length === 0) {
    return invalid_input('URL import requires non-empty fetched HTML.');
  }

  try {
    const now = input.now ?? new Date();
    const timestamp = now.toISOString();
    const title = infer_url_title(parsed_url);
    const slug = create_slug(title);
    const source_id = await create_available_source_id({
      now,
      slug,
      ingest_type: 'input_url',
      storage_config: input.storage_config,
      cwd: input.cwd,
    });

    const source: Source = build_user_import_source({
      source_id,
      title,
      ingest_type: 'input_url',
      content_type: 'link',
      user_input_type: 'url',
      timestamp,
      url: parsed_url.href,
    });

    const created_source = await create_source(
      {
        source,
        raw_file_name: 'fetched.html',
        raw_content: raw_html,
      },
      {
        config: input.storage_config,
        cwd: input.cwd,
      },
    );

    return {
      ok: true,
      data: {
        source_id: created_source.id,
        source: summarize_source(created_source),
      },
      next_actions: next_actions_for_source(created_source.id),
    };
  } catch (error) {
    if (error instanceof StorageError) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_FAILED',
          message: error.message,
          cause: error,
        },
      };
    }

    return invalid_input('URL import failed.', error);
  }
}

async function fetch_public_html(url: string): Promise<string> {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'ai-knowledge/0.1.0',
      accept: 'text/html,application/xhtml+xml',
    },
  });

  const final_url = new URL(response.url);
  if (!response.ok || !is_public_http_url(final_url)) {
    throw new Error(`Unexpected response status: ${response.status}`);
  }

  const content_type = response.headers.get('content-type') ?? '';
  if (!content_type.toLowerCase().includes('text/html')) {
    throw new Error('Fetched URL did not return HTML content.');
  }

  return response.text();
}

function is_public_http_url(url: URL): boolean {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false;
  }

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.corp')
  ) {
    return false;
  }

  if (
    /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.)/u.test(
      hostname,
    )
  ) {
    return false;
  }

  if (hostname === '0.0.0.0' || hostname === '::1' || hostname === '[::1]') {
    return false;
  }

  return true;
}

function infer_url_title(url: URL): string {
  const pathname = url.pathname.replace(/\/+$/u, '');
  const last_segment = pathname.split('/').filter(Boolean).at(-1);
  if (last_segment !== undefined) {
    return decodeURIComponent(last_segment);
  }

  return url.hostname;
}

function invalid_input(
  message: string,
  cause?: unknown,
): WorkflowResult<IngestUrlWorkflowData> {
  return {
    ok: false,
    error: {
      code: 'INVALID_INPUT',
      message,
      cause,
    },
  };
}
