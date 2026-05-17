import type { z } from 'zod';
import type { AgentModelConfigInput } from './config.js';

export type GenerateTextInput = {
  system_prompt: string;
  user_prompt: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
};

export type GenerateTextResult = {
  text: string;
};

export type GenerateJsonInput<TSchema extends z.ZodType> = GenerateTextInput & {
  schema: TSchema;
};

export interface LlmClient {
  generate_text(input: GenerateTextInput): Promise<GenerateTextResult>;
  generate_json<TSchema extends z.ZodType>(
    input: GenerateJsonInput<TSchema>,
  ): Promise<z.infer<TSchema>>;
}

export type LlmClientConfig = AgentModelConfigInput;
