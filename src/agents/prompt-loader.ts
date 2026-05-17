import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentError } from './errors.js';

const prompts_dir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'prompts',
);

export async function load_prompt(prompt_name: string): Promise<string> {
  const prompt_path = resolve_prompt_path(prompt_name);

  try {
    return await readFile(prompt_path, 'utf8');
  } catch (error) {
    throw new AgentError({
      code: 'PROMPT_LOAD_FAILED',
      message: `Failed to load prompt: ${prompt_name}`,
      cause: error,
    });
  }
}

function resolve_prompt_path(prompt_name: string): string {
  if (
    path.isAbsolute(prompt_name) ||
    prompt_name.split(/[\\/]/u).includes('..') ||
    path.basename(prompt_name) !== prompt_name
  ) {
    throw new AgentError({
      code: 'PROMPT_LOAD_FAILED',
      message: `Invalid prompt name: ${prompt_name}`,
    });
  }

  const resolved = path.resolve(prompts_dir, prompt_name);
  const root = path.resolve(prompts_dir);

  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new AgentError({
      code: 'PROMPT_LOAD_FAILED',
      message: `Prompt path escapes prompts directory: ${prompt_name}`,
    });
  }

  return resolved;
}
