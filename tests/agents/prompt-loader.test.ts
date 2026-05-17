import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AgentError } from '../../src/agents/errors.js';
import { load_prompt } from '../../src/agents/prompt-loader.js';

describe('prompt loader', () => {
  it('loads a prompt from the prompts directory', async () => {
    const prompt = await load_prompt('draft-understanding.md');

    expect(prompt).toContain('# Role');
    expect(prompt).toContain('Understand Agent');
  });

  it('throws AgentError for a missing prompt', async () => {
    await expect(load_prompt('missing.md')).rejects.toMatchObject({
      name: 'AgentError',
      code: 'PROMPT_LOAD_FAILED',
    } satisfies Partial<AgentError>);
  });

  it('rejects absolute prompt paths', async () => {
    await expect(
      load_prompt(path.resolve('src/agents/prompts/draft-understanding.md')),
    ).rejects.toMatchObject({
      code: 'PROMPT_LOAD_FAILED',
    });
  });

  it('rejects path traversal prompt names', async () => {
    await expect(load_prompt('../package.json')).rejects.toMatchObject({
      code: 'PROMPT_LOAD_FAILED',
    });
    await expect(load_prompt('nested/prompt.md')).rejects.toMatchObject({
      code: 'PROMPT_LOAD_FAILED',
    });
  });
});
