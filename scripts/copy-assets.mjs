import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();

const assets = [
  {
    from: path.join(projectRoot, 'src', 'agents', 'prompts'),
    to: path.join(projectRoot, 'dist', 'agents', 'prompts'),
  },
  {
    from: path.join(
      projectRoot,
      'tests',
      'p0-end-to-end-acceptance.fixture.md',
    ),
    to: path.join(
      projectRoot,
      'dist',
      'tests',
      'p0-end-to-end-acceptance.fixture.md',
    ),
  },
];

for (const asset of assets) {
  await mkdir(path.dirname(asset.to), { recursive: true });
  await cp(asset.from, asset.to, { recursive: true, force: true });
}
