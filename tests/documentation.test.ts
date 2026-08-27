import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { main, type CliIo } from '../src/cli.js';
import { rules } from '../src/rules.js';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

describe('documentation contracts', () => {
  it('documents every built-in rule ID, name, and default severity', async () => {
    const documentation = await readFile(
      path.join(projectRoot, 'docs', 'rules.md'),
      'utf8',
    );

    for (const rule of Object.values(rules)) {
      const severity =
        rule.defaultSeverity[0]?.toUpperCase() + rule.defaultSeverity.slice(1);
      const row = documentation
        .split(/\r?\n/u)
        .find((line) => line.includes(`| \`${rule.id}\` | \`${rule.name}\``));
      expect(row).toBeDefined();
      expect(row).toContain(`| ${severity}`);
    }
  });

  it('keeps CLI documentation aligned with runtime help', async () => {
    const stdout: string[] = [];
    const io: CliIo = {
      stdout: (value) => stdout.push(value),
      stderr: () => undefined,
    };
    expect(await main(['--help'], io)).toBe(0);
    const help = stdout.join('\n');
    const documentation = await readFile(
      path.join(projectRoot, 'docs', 'cli.md'),
      'utf8',
    );

    for (const requiredText of [
      'content-contract init',
      'content-contract verify',
      'content-contract render',
      'content-contract explain',
      '--fail-on error|warning|never',
      '--fail-on error|warning',
      '--now YYYY-MM-DD',
      '--format pretty|json',
    ]) {
      expect(help).toContain(requiredText);
      expect(documentation).toContain(requiredText);
    }
  });

  it('does not retain pre-repository or mutable-install instructions', async () => {
    const documents = await Promise.all(
      ['README.md', 'CONTRIBUTING.md', 'SUPPORT.md', 'docs/setup.md'].map(
        (file) => readFile(path.join(projectRoot, file), 'utf8'),
      ),
    );
    const combined = documents.join('\n');

    expect(combined).not.toContain('npm install\n');
    expect(combined).not.toContain('has not been initialized');
    expect(combined).not.toContain('content-contract-engine-local');
    expect(combined).toContain(
      'https://github.com/Jason-Doyle/ContentContractEngine',
    );
  });
});
