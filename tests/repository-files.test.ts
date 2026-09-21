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

  it('publishes complete repository and npm metadata', async () => {
    const metadata = JSON.parse(
      await readFile(path.join(projectRoot, 'package.json'), 'utf8'),
    ) as unknown;
    expect(metadata).toMatchObject({
      name: 'content-contract-engine',
      publishConfig: {
        access: 'public',
      },
      repository: {
        type: 'git',
        url: 'git+https://github.com/Jason-Doyle/ContentContractEngine.git',
      },
      exports: {
        './schemas/baseline.schema.json': './schemas/baseline.schema.json',
      },
    });
    expect(metadata).not.toMatchObject({ private: true });
  });

  it('pins GitHub Actions to immutable commit hashes', async () => {
    const workflowPaths = await fg('.github/workflows/*.{yml,yaml}', {
      cwd: projectRoot,
      absolute: true,
      onlyFiles: true,
    });
    const workflows = await Promise.all(
      workflowPaths.map((file) => readFile(file, 'utf8')),
    );
    const combined = workflows.join('\n');

    expect(combined).not.toMatch(/\buses:\s+[^@\s]+@(?![0-9a-f]{40}\b)/u);
    expect(combined).toMatch(/actions\/checkout@[0-9a-f]{40}\s+# v7\.0\.1/u);
    expect(combined).toMatch(/actions\/setup-node@[0-9a-f]{40}\s+# v7\.0\.0/u);
    expect(combined).toContain('- 22');
    expect(combined).toContain('- 24');
    expect(combined).toContain('- ubuntu-latest');
    expect(combined).toContain('- windows-latest');
    expect(combined).toContain('name: CI');
    expect(combined).toContain('id-token: write');
  });
});
