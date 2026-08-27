import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { verify } from '../src/index.js';
import {
  baseConfig,
  createTemporaryProject,
  createValidProject,
  writeProjectFile,
} from './helpers.js';

describe('internal links', () => {
  it('resolves files, GitHub-style heading slugs, references, and query strings', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(
      root,
      [
        '---',
        'title: Home',
        '---',
        '',
        '# Home',
        '',
        '[Architecture][architecture]',
        '',
        '[Same heading](#home)',
        '',
        '[architecture]: architecture.md?view=full#validation-pipeline',
        '',
      ].join('\n'),
    );
    await writeProjectFile(
      root,
      'content/architecture.md',
      '---\ntitle: Architecture\n---\n\n# Architecture\n\n## Validation pipeline\n',
    );

    const result = await verify(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });

    expect(result.findings).toEqual([]);
  });

  it('reports missing targets and missing anchors', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(
      root,
      [
        '---',
        'title: Home',
        '---',
        '',
        '# Home',
        '',
        '[Missing file](missing.md)',
        '[Missing heading](#absent)',
        '',
      ].join('\n'),
    );

    const result = await verify(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });

    expect(result.findings.map((finding) => finding.ruleId)).toEqual([
      'CCE002',
      'CCE003',
    ]);
  });

  it('rejects links that escape the project root', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(
      root,
      '---\ntitle: Home\n---\n\n# Home\n\n[Outside](../../outside.md)\n',
    );

    const result = await verify(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.ruleId).toBe('CCE002');
    expect(result.findings[0]?.message).toContain('escapes the project root');
  });

  it('catches case-only path mistakes on case-insensitive systems', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(
      root,
      '---\ntitle: Home\n---\n\n# Home\n\n[Asset](Asset.txt)\n',
    );
    await writeProjectFile(root, 'content/asset.txt', 'asset');

    const result = await verify(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });

    expect(result.findings).toEqual([
      expect.objectContaining({
        ruleId: 'CCE002',
      }),
    ]);
  });

  it('supports root-relative, extensionless, asset, image, and external links', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(
      root,
      [
        '---',
        'title: Home',
        '---',
        '',
        '# Home',
        '',
        '[Architecture](/content/architecture)',
        '![Asset](asset.txt)',
        '[External](https://example.com/docs)',
        '[Email](mailto:maintainers@example.com)',
        '',
      ].join('\n'),
    );
    await writeProjectFile(
      root,
      'content/architecture.md',
      '---\ntitle: Architecture\n---\n\n# Architecture\n',
    );
    await writeProjectFile(root, 'content/asset.txt', 'asset');

    const result = await verify(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });

    expect(result.findings).toEqual([]);
  });

  it('does not crash on malformed percent encoding', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(
      root,
      '---\ntitle: Home\n---\n\n# Home\n\n[Bad](missing%ZZ.md)\n',
    );

    const result = await verify(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });

    expect(result.findings[0]?.ruleId).toBe('CCE002');
  });

  it('requires directory links to resolve through an index document', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(
      root,
      '---\ntitle: Home\n---\n\n# Home\n\n[Folder](folder)\n',
    );
    await writeProjectFile(root, 'content/folder/asset.txt', 'asset');

    const result = await verify(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });

    expect(result.findings[0]?.ruleId).toBe('CCE002');
  });

  it('does not accept stale generated output as a source link target', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(
      root,
      '---\ntitle: Home\n---\n\n# Home\n\n[Generated](../rendered/stale.md)\n',
    );
    await writeProjectFile(root, 'rendered/stale.md', '# Stale\n');

    const result = await verify(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });

    expect(result.findings[0]?.message).toContain(
      'cannot link to generated render output',
    );
  });

  it('rejects Windows path separators on every operating system', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(
      root,
      '---\ntitle: Home\n---\n\n# Home\n\n[Child](sub\\child.md)\n',
    );
    await writeProjectFile(
      root,
      'content/sub/child.md',
      '---\ntitle: Child\n---\n\n# Child\n',
    );

    const result = await verify(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });

    expect(result.findings[0]?.message).toContain(
      'uses a Windows path separator',
    );
  });

  it('checks anchors in Markdown files outside the configured source set', async () => {
    const root = await createTemporaryProject();
    const config = JSON.parse(baseConfig()) as Record<string, unknown>;
    config.sources = [
      {
        id: 'docs',
        include: ['content/index.md'],
      },
    ];
    delete config.facts;
    await writeProjectFile(
      root,
      'content-contract.config.json',
      `${JSON.stringify(config, null, 2)}\n`,
    );
    await writeProjectFile(
      root,
      'content/index.md',
      '# Home\n\n[Missing](notes.md#missing)\n',
    );
    await writeProjectFile(root, 'content/notes.md', '# Present\n');

    const result = await verify(
      path.join(root, 'content-contract.config.json'),
      { now: new Date('2026-08-27T00:00:00.000Z') },
    );

    expect(result.findings[0]?.ruleId).toBe('CCE003');
  });

  it('resolves extensionless links to dotted Markdown basenames', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(
      root,
      '---\ntitle: Home\n---\n\n# Home\n\n[Release](release-1.0)\n',
    );
    await writeProjectFile(
      root,
      'content/release-1.0.md',
      '---\ntitle: Release\n---\n\n# Release\n',
    );

    const result = await verify(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });

    expect(result.findings).toEqual([]);
  });

  it('reports anchors that cannot be verified in malformed linked documents', async () => {
    const root = await createTemporaryProject();
    const config = JSON.parse(baseConfig()) as Record<string, unknown>;
    config.sources = [
      {
        id: 'docs',
        include: ['content/index.md'],
      },
    ];
    delete config.facts;
    await writeProjectFile(
      root,
      'content-contract.config.json',
      `${JSON.stringify(config, null, 2)}\n`,
    );
    await writeProjectFile(
      root,
      'content/index.md',
      '# Home\n\n[Notes](notes.md#top)\n',
    );
    await writeProjectFile(root, 'content/notes.md', '---\ntitle: Notes\n');

    const result = await verify(
      path.join(root, 'content-contract.config.json'),
      { now: new Date('2026-08-27T00:00:00.000Z') },
    );

    expect(result.findings[0]?.ruleId).toBe('CCE012');
  });
});
