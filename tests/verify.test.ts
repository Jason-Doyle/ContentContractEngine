import { describe, expect, it } from 'vitest';

import {
  type ContentValidator,
  verify,
  verifyProject,
  loadProject,
} from '../src/index.js';
import {
  createTemporaryProject,
  createValidProject,
  writeProjectFile,
} from './helpers.js';

describe('verification', () => {
  it('passes a valid project', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(root);

    const result = await verify(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });

    expect(result.passed).toBe(true);
    expect(result.counts).toEqual({
      files: 1,
      facts: 1,
      errors: 0,
      warnings: 0,
      infos: 0,
    });
  });

  it('reports frontmatter, fact, and freshness failures', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(
      root,
      [
        '---',
        'title: ""',
        'reviewBy: 2026-01-01',
        'expires: 2026-08-27',
        '---',
        '',
        '# Home',
        '',
        '{{fact:missing}}',
        '',
      ].join('\n'),
    );

    const result = await verify(configPath, {
      now: new Date('2026-08-27T12:00:00.000Z'),
    });

    expect(result.passed).toBe(false);
    expect(result.findings.map((finding) => finding.ruleId)).toEqual([
      'CCE001',
      'CCE005',
      'CCE006',
      'CCE004',
    ]);
  });

  it('warns when content and facts approach review dates', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(
      root,
      '---\ntitle: Home\nreviewBy: 2026-09-01\n---\n\n# Home\n',
    );
    await writeProjectFile(
      root,
      'content/facts.yaml',
      'version: 1\nfacts:\n  api_version:\n    value: v2\n    reviewBy: 2026-09-02\n',
    );

    const result = await verify(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
      failOn: 'warning',
    });

    expect(result.passed).toBe(false);
    expect(result.findings.map((finding) => finding.ruleId)).toEqual([
      'CCE010',
      'CCE007',
    ]);
  });

  it('reports invalid freshness dates even without a schema format', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(
      root,
      '---\ntitle: Home\nreviewBy: not-a-date\n---\n\n# Home\n',
    );

    const result = await verify(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });

    expect(result.findings).toEqual([
      expect.objectContaining({
        ruleId: 'CCE011',
        file: 'content/index.md',
      }),
    ]);
  });

  it('sorts custom validator output with built-in findings', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(root);
    const project = await loadProject(configPath);
    const customValidator: ContentValidator = {
      name: 'custom',
      validate: () => [
        {
          ruleId: 'CUSTOM002',
          ruleName: 'later',
          severity: 'warning',
          file: 'z.md',
          message: 'Later finding.',
          help: 'Fix it.',
        },
        {
          ruleId: 'CUSTOM001',
          ruleName: 'first',
          severity: 'error',
          file: 'a.md',
          message: 'First finding.',
          help: 'Fix it.',
        },
      ],
    };

    const result = await verifyProject(project, {
      now: new Date('2026-08-27T00:00:00.000Z'),
      validators: [customValidator],
    });

    expect(result.findings.map((finding) => finding.ruleId)).toEqual([
      'CUSTOM001',
      'CUSTOM002',
    ]);
  });

  it('can report errors without failing when failOn is never', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(
      root,
      '---\ntitle: Home\n---\n\n# Home\n\n[Missing](missing.md)\n',
    );

    const result = await verify(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
      failOn: 'never',
    });

    expect(result.counts.errors).toBe(1);
    expect(result.passed).toBe(true);
  });
});
