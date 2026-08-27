import { mkdir, readFile, rename, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { render } from '../src/index.js';
import {
  createTemporaryProject,
  createValidProject,
  writeProjectFile,
} from './helpers.js';

describe('rendering', () => {
  it('renders canonical facts into a separate tree without changing sources', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(root);
    const sourcePath = path.join(root, 'content', 'index.md');
    const sourceBefore = await readFile(sourcePath, 'utf8');

    const execution = await render(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });

    expect(execution.verification.passed).toBe(true);
    expect(execution.render?.files).toEqual(['content/index.md']);
    await expect(
      readFile(path.join(root, 'rendered', 'content', 'index.md'), 'utf8'),
    ).resolves.toContain('API version: v2.');
    await expect(readFile(sourcePath, 'utf8')).resolves.toBe(sourceBefore);
  });

  it('does not write output when verification has errors', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(
      root,
      '---\ntitle: Home\n---\n\n# Home\n\n{{fact:missing}}\n',
    );

    const execution = await render(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });

    expect(execution.render).toBeNull();
    expect(execution.verification.passed).toBe(false);
  });

  it('respects the configured warning failure threshold', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(
      root,
      '---\ntitle: Home\nreviewBy: 2026-09-01\n---\n\n# Home\n',
    );
    const config = JSON.parse(await readFile(configPath, 'utf8')) as Record<
      string,
      unknown
    >;
    config.gate = { failOn: 'warning' };
    await writeProjectFile(
      root,
      'content-contract.config.json',
      `${JSON.stringify(config, null, 2)}\n`,
    );

    const execution = await render(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });

    expect(execution.verification.counts.warnings).toBe(1);
    expect(execution.verification.passed).toBe(false);
    expect(execution.render).toBeNull();
  });

  it('always blocks errors when the project verification gate is never', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(
      root,
      '---\ntitle: Home\n---\n\n# Home\n\n{{fact:missing}}\n',
    );
    const config = JSON.parse(await readFile(configPath, 'utf8')) as Record<
      string,
      unknown
    >;
    config.gate = { failOn: 'never' };
    await writeProjectFile(
      root,
      'content-contract.config.json',
      `${JSON.stringify(config, null, 2)}\n`,
    );

    const execution = await render(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });

    expect(execution.verification.failOn).toBe('error');
    expect(execution.verification.passed).toBe(false);
    expect(execution.render).toBeNull();
  });

  it('can safely replace previously rendered files', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(root);

    await render(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });
    const second = await render(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });

    expect(second.render?.files).toEqual(['content/index.md']);
  });

  it('blocks rendering through an existing symbolic link', async () => {
    const root = await createTemporaryProject();
    const outside = await createTemporaryProject();
    const configPath = await createValidProject(root);
    await mkdir(outside, { recursive: true });
    await symlink(
      outside,
      path.join(root, 'rendered'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );

    await expect(
      render(configPath, {
        now: new Date('2026-08-27T00:00:00.000Z'),
      }),
    ).rejects.toMatchObject({
      code: 'SYMLINK_WRITE_BLOCKED',
    });
  });

  it('removes files owned by the previous render manifest', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(root);
    await writeProjectFile(
      root,
      'content/old.md',
      '---\ntitle: Old\n---\n\n# Old\n',
    );
    await render(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });
    await rm(path.join(root, 'content', 'old.md'));

    const second = await render(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });

    expect(second.render?.removedFiles).toEqual(['content/old.md']);
    await expect(
      readFile(path.join(root, 'rendered', 'content', 'old.md'), 'utf8'),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects an invalid render manifest instead of deleting files', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(root);
    await writeProjectFile(
      root,
      'rendered/.content-contract-manifest.json',
      '{"files":"not-an-array"}',
    );

    await expect(
      render(configPath, {
        now: new Date('2026-08-27T00:00:00.000Z'),
      }),
    ).rejects.toMatchObject({
      code: 'RENDER_MANIFEST_INVALID',
    });
  });

  it('renders case-only source renames without deleting the new output', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(root);
    const lowerSource = path.join(root, 'content', 'index.md');
    const upperSource = path.join(root, 'content', 'Index.md');
    const temporarySource = path.join(root, 'content', 'rename.tmp');
    await rename(lowerSource, temporarySource);
    await rename(temporarySource, upperSource);
    await render(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });
    await rename(upperSource, temporarySource);
    await rename(temporarySource, lowerSource);

    const second = await render(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });

    expect(second.render?.removedFiles).toEqual(['content/Index.md']);
    await expect(
      readFile(path.join(root, 'rendered', 'content', 'index.md'), 'utf8'),
    ).resolves.toContain('# Home');
  });

  it('never discovers its output when the directory contains glob characters', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(root);
    const config = JSON.parse(await readFile(configPath, 'utf8')) as Record<
      string,
      unknown
    >;
    config.sources = [{ id: 'docs', include: ['**/*.md'] }];
    config.render = { outputDirectory: 'out(1)' };
    await writeProjectFile(
      root,
      'content-contract.config.json',
      `${JSON.stringify(config, null, 2)}\n`,
    );

    await render(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });
    const second = await render(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });

    expect(second.verification.counts.files).toBe(1);
    expect(second.render?.files).toEqual(['content/index.md']);
  });

  it('rejects directory entries in the managed render manifest', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(root);
    await writeProjectFile(
      root,
      'rendered/.content-contract-manifest.json',
      '{"schemaVersion":1,"files":["stale"]}',
    );
    await mkdir(path.join(root, 'rendered', 'stale'));

    await expect(
      render(configPath, {
        now: new Date('2026-08-27T00:00:00.000Z'),
      }),
    ).rejects.toMatchObject({
      code: 'RENDER_MANIFEST_ENTRY_INVALID',
    });
  });
});
