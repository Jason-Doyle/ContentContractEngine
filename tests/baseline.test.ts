import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import { createBaseline, render, verify } from '../src/index.js';
import {
  createTemporaryProject,
  createValidProject,
  writeProjectFile,
} from './helpers.js';

describe('verification baselines', () => {
  it('suppresses known findings while failing new regressions', async () => {
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
        '[Known missing link](known.md)',
        '',
      ].join('\n'),
    );
    await configureBaseline(root, configPath);

    await expect(
      verify(configPath, {
        now: new Date('2026-08-27T00:00:00.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'BASELINE_FILE_MISSING' });

    const baseline = await createBaseline(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });
    expect(baseline).toEqual({
      file: '.content-contract-baseline.json',
      entries: 1,
    });

    const accepted = await verify(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });
    expect(accepted.passed).toBe(true);
    expect(accepted.findings).toEqual([]);
    expect(accepted.counts.baselined).toBe(1);

    await writeProjectFile(
      root,
      'content/index.md',
      [
        '---',
        'title: Home',
        '---',
        '',
        '# Home',
        '',
        '[Known missing link](known.md)',
        '[New missing link](new.md)',
        '',
      ].join('\n'),
    );

    const regressed = await verify(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });
    expect(regressed.passed).toBe(false);
    expect(regressed.counts.baselined).toBe(1);
    expect(regressed.findings).toHaveLength(1);
    expect(regressed.findings[0]?.ruleId).toBe('CCE002');
    expect(regressed.findings[0]?.message).toContain('new.md');
  });

  it('does not allow baselined errors to produce rendered output', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(
      root,
      '---\ntitle: Home\n---\n\n# Home\n\n{{fact:missing}}\n',
    );
    await configureBaseline(root, configPath);
    await createBaseline(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });

    const execution = await render(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });

    expect(execution.verification.passed).toBe(false);
    expect(execution.verification.counts.baselined).toBe(0);
    expect(execution.render).toBeNull();
  });

  it('rejects malformed baseline files', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(root);
    await configureBaseline(root, configPath);
    await writeProjectFile(
      root,
      '.content-contract-baseline.json',
      '{"version":1,"findings":[{"ruleId":"CCE002"}]}\n',
    );

    await expect(
      verify(configPath, {
        now: new Date('2026-08-27T00:00:00.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'BASELINE_INVALID' });
  });

  it('refuses to overwrite project inputs or generated output', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(root);
    const config = JSON.parse(await readFile(configPath, 'utf8')) as Record<
      string,
      unknown
    >;

    for (const file of [
      'content-contract.config.json',
      'content/index.md',
      'rendered/baseline.json',
    ]) {
      config.baseline = { file };
      await writeProjectFile(
        root,
        'content-contract.config.json',
        `${JSON.stringify(config, null, 2)}\n`,
      );
      await expect(
        createBaseline(configPath, {
          now: new Date('2026-08-27T00:00:00.000Z'),
        }),
      ).rejects.toMatchObject({ code: 'BASELINE_PATH_UNSAFE' });
    }
  });

  it.skipIf(process.platform !== 'win32')(
    'rejects case-only aliases of protected files on Windows',
    async () => {
      const root = await createTemporaryProject();
      const configPath = await createValidProject(root);
      const config = JSON.parse(await readFile(configPath, 'utf8')) as Record<
        string,
        unknown
      >;
      config.baseline = { file: 'CONTENT-CONTRACT.CONFIG.JSON' };
      await writeProjectFile(
        root,
        'content-contract.config.json',
        `${JSON.stringify(config, null, 2)}\n`,
      );

      await expect(
        createBaseline(configPath, {
          now: new Date('2026-08-27T00:00:00.000Z'),
        }),
      ).rejects.toMatchObject({ code: 'BASELINE_PATH_UNSAFE' });
    },
  );
});

async function configureBaseline(
  root: string,
  configPath: string,
): Promise<void> {
  const config = JSON.parse(await readFile(configPath, 'utf8')) as Record<
    string,
    unknown
  >;
  config.baseline = {
    file: '.content-contract-baseline.json',
  };
  await writeProjectFile(
    root,
    'content-contract.config.json',
    `${JSON.stringify(config, null, 2)}\n`,
  );
}
