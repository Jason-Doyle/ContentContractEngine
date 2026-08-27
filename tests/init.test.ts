import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { initializeProject, verify } from '../src/index.js';
import { createTemporaryProject } from './helpers.js';

describe('project initialization', () => {
  it('creates a project that passes verification', async () => {
    const root = await createTemporaryProject();

    const initialized = await initializeProject(root);
    const result = await verify(
      path.join(root, 'content-contract.config.json'),
      { now: new Date('2026-08-27T00:00:00.000Z') },
    );

    expect(initialized.files).toContain('content/index.md');
    expect(result.passed).toBe(true);
  });

  it('refuses to overwrite generated files without force', async () => {
    const root = await createTemporaryProject();
    await initializeProject(root);

    await expect(initializeProject(root)).rejects.toMatchObject({
      code: 'INIT_FILES_EXIST',
    });
  });

  it('overwrites only known generated files with force', async () => {
    const root = await createTemporaryProject();
    await initializeProject(root);
    const extraPath = path.join(root, 'keep.txt');
    await import('node:fs/promises').then(({ writeFile }) =>
      writeFile(extraPath, 'keep', 'utf8'),
    );

    await initializeProject(root, true);

    await expect(readFile(extraPath, 'utf8')).resolves.toBe('keep');
  });

  it('creates freshness placeholders that remain valid long term', async () => {
    const root = await createTemporaryProject();
    await initializeProject(root);

    const result = await verify(
      path.join(root, 'content-contract.config.json'),
      { now: new Date('2050-01-01T00:00:00.000Z') },
    );

    expect(result.passed).toBe(true);
    expect(result.findings).toEqual([]);
  });
});
