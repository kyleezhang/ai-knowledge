import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import {
  resolve_knowledge_dir,
  resolve_storage_config,
  type StorageConfig,
} from './config.js';

export const KNOWLEDGE_SUBDIRS = [
  'candidates',
  'sources',
  'notes',
  'index',
  'tasks',
  'schedules',
] as const;

export type InitStorageResult = {
  knowledge_dir: string;
  created_dirs: string[];
};

export async function init_storage(input: {
  config?: Partial<StorageConfig>;
  cwd?: string;
}): Promise<InitStorageResult> {
  const config = resolve_storage_config(input.config);
  const knowledge_dir = resolve_knowledge_dir(config, input.cwd);
  const created_dirs = [
    knowledge_dir,
    ...KNOWLEDGE_SUBDIRS.map((subdir) => path.join(knowledge_dir, subdir)),
  ];

  for (const dir of created_dirs) {
    await mkdir(dir, { recursive: true });
  }

  return {
    knowledge_dir,
    created_dirs,
  };
}
