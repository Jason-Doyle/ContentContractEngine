import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { initializeProject, verify } from '../src/index.js';
import { createTemporaryProject } from './helpers.js';

describe('project initialization', () => {
  it('creates a project that passes verification', async () => {
    const root = await createTemporaryProject();

    const initialized = await initializeProject(root, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });
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

    await initializeProject(root, {
      force: true,
      now: new Date('2026-08-27T00:00:00.000Z'),
    });

    await expect(readFile(extraPath, 'utf8')).resolves.toBe('keep');
  });

  it('creates a meaningful review date from an injected clock', async () => {
    const root = await createTemporaryProject();
    await initializeProject(root, {
      now: new Date('2026-08-27T12:00:00.000Z'),
    });

    await expect(
      readFile(path.join(root, 'content', 'index.md'), 'utf8'),
    ).resolves.toContain('reviewBy: 2027-02-23');
  });

  it('initializes an existing source without creating sample content', async () => {
    const root = await createTemporaryProject();
    const initialized = await initializeProject(root, {
      source: 'docs/**/*.{md,mdx}',
    });

    expect(initialized.files).toEqual([
      '.content-contract-baseline.json',
      '.content-contract/.gitignore',
      'content-contract.config.json',
    ]);
    await expect(
      readFile(path.join(root, 'content-contract.config.json'), 'utf8'),
    ).resolves.toContain('docs/**/*.{md,mdx}');
    await expect(
      readFile(path.join(root, 'content', 'index.md'), 'utf8'),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects empty or Windows-style source globs', async () => {
    const root = await createTemporaryProject();

    await expect(
      initializeProject(root, { source: ' ' }),
    ).rejects.toMatchObject({
      code: 'INIT_SOURCE_INVALID',
    });
    await expect(
      initializeProject(root, { source: 'docs\\**\\*.md' }),
    ).rejects.toMatchObject({
      code: 'INIT_SOURCE_INVALID',
    });
  });

  it('rejects an invalid injected clock', async () => {
    const root = await createTemporaryProject();

    await expect(
      initializeProject(root, { now: new Date('invalid') }),
    ).rejects.toMatchObject({
      code: 'INIT_DATE_INVALID',
    });
  });

  it('allows the generated review date to become overdue', async () => {
    const root = await createTemporaryProject();
    await initializeProject(root, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });

    const result = await verify(
      path.join(root, 'content-contract.config.json'),
      { now: new Date('2027-02-24T00:00:00.000Z') },
    );

    expect(result.passed).toBe(false);
    expect(result.findings.some((finding) => finding.ruleId === 'CCE006')).toBe(
      true,
    );
  });
});
