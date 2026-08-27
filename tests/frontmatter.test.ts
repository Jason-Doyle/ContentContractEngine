import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { loadProject, verify } from '../src/index.js';
import {
  baseConfig,
  createTemporaryProject,
  frontmatterSchema,
  writeProjectFile,
} from './helpers.js';

describe('frontmatter and Markdown parsing', () => {
  it('supports documents without frontmatter when no schema is configured', async () => {
    const root = await createTemporaryProject();
    const config = JSON.parse(baseConfig()) as Record<string, unknown>;
    config.sources = [{ id: 'docs', include: ['content/**/*.md'] }];
    delete config.facts;
    await writeProjectFile(
      root,
      'content-contract.config.json',
      `${JSON.stringify(config, null, 2)}\n`,
    );
    await writeProjectFile(root, 'content/index.md', '# Home\n');

    const result = await verify(
      path.join(root, 'content-contract.config.json'),
      { now: new Date('2026-08-27T00:00:00.000Z') },
    );

    expect(result.passed).toBe(true);
  });

  it.each([
    {
      source: '---\ntitle: Home\n',
      code: 'FRONTMATTER_UNTERMINATED',
    },
    {
      source: '---\ntitle: [\n---\n# Home\n',
      code: 'FRONTMATTER_YAML_INVALID',
    },
    {
      source: '---\n- one\n- two\n---\n# Home\n',
      code: 'FRONTMATTER_NOT_OBJECT',
    },
  ])('rejects malformed frontmatter: $code', async ({ source, code }) => {
    const root = await createTemporaryProject();
    await writeProjectFile(root, 'content-contract.config.json', baseConfig());
    await writeProjectFile(root, 'content/schema.json', frontmatterSchema);
    await writeProjectFile(
      root,
      'content/facts.yaml',
      'version: 1\nfacts: {}\n',
    );
    await writeProjectFile(root, 'content/index.md', source);

    await expect(
      loadProject(path.join(root, 'content-contract.config.json')),
    ).rejects.toMatchObject({ code });
  });

  it('supports MDX, duplicate heading slugs, and explicit HTML anchors', async () => {
    const root = await createTemporaryProject();
    const config = JSON.parse(baseConfig()) as Record<string, unknown>;
    config.sources = [{ id: 'docs', include: ['content/**/*.{md,mdx}'] }];
    delete config.facts;
    await writeProjectFile(
      root,
      'content-contract.config.json',
      `${JSON.stringify(config, null, 2)}\n`,
    );
    await writeProjectFile(
      root,
      'content/index.mdx',
      [
        "export const example = '{{fact:not_real}}'",
        '',
        '# Repeat',
        '# Repeat',
        '<span id="custom-anchor">Target</span>',
        '<Component value="ok" />',
        '[Second](#repeat-1)',
        '[Custom](#custom-anchor)',
        '',
      ].join('\n'),
    );

    const result = await verify(
      path.join(root, 'content-contract.config.json'),
      { now: new Date('2026-08-27T00:00:00.000Z') },
    );

    expect(result.findings).toEqual([]);
  });
});
