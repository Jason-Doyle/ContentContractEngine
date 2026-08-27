import { describe, expect, it } from 'vitest';
import path from 'node:path';

import { loadProject } from '../src/index.js';
import {
  baseConfig,
  createTemporaryProject,
  frontmatterSchema,
  validFacts,
  writeProjectFile,
} from './helpers.js';

describe('project configuration', () => {
  it('loads defaults and resolves project-relative paths', async () => {
    const root = await createTemporaryProject();
    await writeProjectFile(
      root,
      'content-contract.config.json',
      baseConfig({
        freshness: undefined,
        gate: undefined,
        render: undefined,
      }),
    );
    await writeProjectFile(root, 'content/schema.json', frontmatterSchema);
    await writeProjectFile(root, 'content/facts.yaml', validFacts);
    await writeProjectFile(
      root,
      'content/index.md',
      '---\ntitle: Home\n---\n\n# Home\n',
    );

    const project = await loadProject(
      path.join(root, 'content-contract.config.json'),
    );

    expect(project.config.freshness).toEqual({
      warningDays: 30,
      reviewByField: 'reviewBy',
      expiresField: 'expires',
    });
    expect(project.config.gate.failOn).toBe('error');
    expect(project.config.render.outputDirectory).toBe(
      path.join(root, '.content-contract', 'rendered'),
    );
  });

  it('rejects unknown configuration properties', async () => {
    const root = await createTemporaryProject();
    await writeProjectFile(
      root,
      'content-contract.config.json',
      baseConfig({ misspelledSetting: true }),
    );

    await expect(
      loadProject(path.join(root, 'content-contract.config.json')),
    ).rejects.toMatchObject({
      code: 'CONFIG_INVALID',
    });
  });

  it('rejects output directories outside the project', async () => {
    const root = await createTemporaryProject();
    await writeProjectFile(
      root,
      'content-contract.config.json',
      baseConfig({
        render: {
          outputDirectory: '../outside',
        },
      }),
    );
    await writeProjectFile(root, 'content/schema.json', frontmatterSchema);

    await expect(
      loadProject(path.join(root, 'content-contract.config.json')),
    ).rejects.toMatchObject({
      code: 'PATH_OUTSIDE_PROJECT',
    });
  });

  it('rejects overlapping source definitions', async () => {
    const root = await createTemporaryProject();
    const config = JSON.parse(baseConfig()) as Record<string, unknown>;
    config.sources = [
      {
        id: 'first',
        include: ['content/**/*.md'],
      },
      {
        id: 'second',
        include: ['content/**/*.md'],
      },
    ];
    delete config.facts;
    await writeProjectFile(
      root,
      'content-contract.config.json',
      `${JSON.stringify(config, null, 2)}\n`,
    );
    await writeProjectFile(root, 'content/index.md', '# Home\n');

    await expect(
      loadProject(path.join(root, 'content-contract.config.json')),
    ).rejects.toMatchObject({
      code: 'SOURCE_OVERLAP',
    });
  });

  it('rejects empty sources unless they are explicitly allowed', async () => {
    const root = await createTemporaryProject();
    const config = JSON.parse(baseConfig()) as Record<string, unknown>;
    config.sources = [
      {
        id: 'docs',
        include: ['missing/**/*.md'],
      },
    ];
    delete config.facts;
    await writeProjectFile(
      root,
      'content-contract.config.json',
      `${JSON.stringify(config, null, 2)}\n`,
    );

    await expect(
      loadProject(path.join(root, 'content-contract.config.json')),
    ).rejects.toMatchObject({
      code: 'SOURCE_EMPTY',
    });

    config.sources = [
      {
        id: 'docs',
        include: ['missing/**/*.md'],
        allowEmpty: true,
      },
    ];
    await writeProjectFile(
      root,
      'content-contract.config.json',
      `${JSON.stringify(config, null, 2)}\n`,
    );

    await expect(
      loadProject(path.join(root, 'content-contract.config.json')),
    ).resolves.toMatchObject({
      documents: [],
    });
  });
});
