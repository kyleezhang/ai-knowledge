import path from 'node:path';

export type StorageConfig = {
  knowledge_dir: string;
};

export const DEFAULT_STORAGE_CONFIG: StorageConfig = {
  knowledge_dir: './knowledge',
};

export function resolve_storage_config(
  config: Partial<StorageConfig> = {},
): StorageConfig {
  return {
    knowledge_dir: config.knowledge_dir ?? DEFAULT_STORAGE_CONFIG.knowledge_dir,
  };
}

export function resolve_knowledge_dir(
  config: StorageConfig,
  cwd = process.cwd(),
): string {
  return path.resolve(cwd, config.knowledge_dir);
}
