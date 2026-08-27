import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { loadProject, renderProject, verify } from '../src/index.js';
import {
  baseConfig,
  createTemporaryProject,
  createValidProject,
  frontmatterSchema,
  writeProjectFile,
} from './helpers.js';

describe('canonical facts', () => {
  it('reports fact references when no catalog is configured', async () => {
    const root = await createTemporaryProject();
    const config = JSON.parse(baseConfig()) as Record<string, unknown>;
    delete config.facts;
    await writeProjectFile(
      root,
      'content-contract.config.json',
      `${JSON.stringify(config, null, 2)}\n`,
    );
    await writeProjectFile(root, 'content/schema.json', frontmatterSchema);
    await writeProjectFile(
      root,
      'content/index.md',
      '---\ntitle: Home\n---\n\n# Home\n\n{{fact:missing}}\n',
    );

    const result = await verify(
      path.join(root, 'content-contract.config.json'),
      { now: new Date('2026-08-27T00:00:00.000Z') },
    );

    expect(result.findings.map((finding) => finding.ruleId)).toEqual([
      'CCE004',
    ]);
  });

  it('rejects malformed YAML and invalid fact structures', async () => {
    const invalidYamlRoot = await createTemporaryProject();
    const invalidYamlConfig = await createValidProject(invalidYamlRoot);
    await writeProjectFile(
      invalidYamlRoot,
      'content/facts.yaml',
      'version: 1\nfacts: [\n',
    );

    await expect(loadProject(invalidYamlConfig)).rejects.toMatchObject({
      code: 'FACTS_YAML_INVALID',
    });

    const invalidFactsRoot = await createTemporaryProject();
    const invalidFactsConfig = await createValidProject(invalidFactsRoot);
    await writeProjectFile(
      invalidFactsRoot,
      'content/facts.yaml',
      'version: 2\nfacts: {}\n',
    );

    await expect(loadProject(invalidFactsConfig)).rejects.toMatchObject({
      code: 'FACTS_INVALID',
    });
  });

  it('reports fact expiry and overdue review dates', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(
      root,
      '---\ntitle: Home\n---\n\n# Home\n',
    );
    await writeProjectFile(
      root,
      'content/facts.yaml',
      [
        'version: 1',
        'facts:',
        '  expired:',
        '    value: old',
        '    expires: 2026-08-27',
        '  overdue:',
        '    value: old',
        '    reviewBy: 2026-08-26',
        '',
      ].join('\n'),
    );

    const result = await verify(configPath, {
      now: new Date('2026-08-27T12:00:00.000Z'),
    });

    expect(result.findings.map((finding) => finding.ruleId)).toEqual([
      'CCE008',
      'CCE009',
    ]);
  });

  it('reports invalid fact dates with the stable date rule', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(
      root,
      '---\ntitle: Home\n---\n\n# Home\n',
    );
    await writeProjectFile(
      root,
      'content/facts.yaml',
      'version: 1\nfacts:\n  invalid:\n    value: old\n    reviewBy: 2026-02-31\n',
    );

    const result = await verify(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });

    expect(result.findings[0]?.ruleId).toBe('CCE011');
  });

  it('uses an explicit fact rendering value', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(root);
    await writeProjectFile(
      root,
      'content/facts.yaml',
      'version: 1\nfacts:\n  api_version:\n    value: 2\n    render: v2 stable\n',
    );
    const project = await loadProject(configPath);

    await renderProject(project);

    await expect(
      import('node:fs/promises').then(({ readFile }) =>
        readFile(path.join(root, 'rendered', 'content', 'index.md'), 'utf8'),
      ),
    ).resolves.toContain('API version: v2 stable.');
  });

  it('refuses direct rendering when a referenced fact is unavailable', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(root);
    const project = await loadProject(configPath);
    const projectWithoutFacts = {
      ...project,
      facts: {
        ...project.facts,
        facts: {},
      },
    };

    await expect(renderProject(projectWithoutFacts)).rejects.toMatchObject({
      code: 'RENDER_FACT_UNKNOWN',
    });
  });

  it('validates and renders fact references in frontmatter', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(
      root,
      '---\ntitle: "{{fact:api_version}} documentation"\n---\n\n# Home\n',
    );

    const verified = await verify(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });
    expect(verified.passed).toBe(true);

    const project = await loadProject(configPath);
    await renderProject(project);
    await expect(
      import('node:fs/promises').then(({ readFile }) =>
        readFile(path.join(root, 'rendered', 'content', 'index.md'), 'utf8'),
      ),
    ).resolves.toContain('title: "v2 documentation"');
  });

  it('reports unknown frontmatter facts before rendering', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(
      root,
      '---\ntitle: "{{fact:ghost}}"\n---\n\n# Home\n',
    );

    const result = await verify(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });

    expect(result.findings[0]?.ruleId).toBe('CCE004');
  });

  it('leaves example fact syntax inside code untouched', async () => {
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
        '`{{fact:not_real}}`',
        '',
        '```markdown',
        '{{fact:api_version}}',
        '```',
        '',
      ].join('\n'),
    );

    const verified = await verify(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });
    expect(verified.findings).toEqual([]);

    const project = await loadProject(configPath);
    await renderProject(project);
    await expect(
      import('node:fs/promises').then(({ readFile }) =>
        readFile(path.join(root, 'rendered', 'content', 'index.md'), 'utf8'),
      ),
    ).resolves.toContain('{{fact:api_version}}');
  });
});
