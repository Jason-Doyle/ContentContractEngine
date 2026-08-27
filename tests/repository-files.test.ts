import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import fg from 'fast-glob';
import { parseDocument } from 'yaml';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

describe('repository setup files', () => {
  it('keeps all GitHub YAML files parseable', async () => {
    const files = await fg('.github/**/*.{yml,yaml}', {
      cwd: projectRoot,
      absolute: true,
      onlyFiles: true,
    });
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const document = parseDocument(await readFile(file, 'utf8'));
      expect(
        document.errors,
        `${path.relative(projectRoot, file)} contains invalid YAML`,
      ).toEqual([]);
    }
  });

  it('publishes repository metadata without enabling npm publication', async () => {
    const metadata = JSON.parse(
      await readFile(path.join(projectRoot, 'package.json'), 'utf8'),
    ) as unknown;
    expect(metadata).toMatchObject({
      name: 'content-contract-engine',
      private: true,
      repository: {
        type: 'git',
        url: 'git+https://github.com/Jason-Doyle/ContentContractEngine.git',
      },
    });
  });

  it('pins GitHub Actions to immutable commit hashes', async () => {
    const workflow = await readFile(
      path.join(projectRoot, '.github', 'workflows', 'ci.yml'),
      'utf8',
    );

    expect(workflow).toMatch(/actions\/checkout@[0-9a-f]{40}\s+# v4/u);
    expect(workflow).toMatch(/actions\/setup-node@[0-9a-f]{40}\s+# v4/u);
    expect(workflow).toContain('- 22');
    expect(workflow).toContain('- 24');
    expect(workflow).toContain('- ubuntu-latest');
    expect(workflow).toContain('- windows-latest');
  });
});
