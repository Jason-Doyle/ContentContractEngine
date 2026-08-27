import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { main, type CliIo } from '../src/cli.js';
import { createTemporaryProject, createValidProject } from './helpers.js';

function captureIo(): {
  io: CliIo;
  stdout: string[];
  stderr: string[];
} {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    io: {
      stdout: (value) => stdout.push(value),
      stderr: (value) => stderr.push(value),
    },
    stdout,
    stderr,
  };
}

describe('CLI', () => {
  it('prints help and version information', async () => {
    const help = captureIo();
    const version = captureIo();

    expect(await main(['--help'], help.io)).toBe(0);
    expect(help.stdout.join('')).toContain('content-contract verify');
    expect(await main(['--version'], version.io)).toBe(0);
    expect(version.stdout.join('')).toContain('0.1.0');
  });

  it('returns verification results as JSON', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(root);
    const output = captureIo();

    const exitCode = await main(
      [
        'verify',
        '--config',
        configPath,
        '--now',
        '2026-08-27',
        '--format',
        'json',
      ],
      output.io,
    );

    expect(exitCode).toBe(0);
    expect(JSON.parse(output.stdout.join(''))).toMatchObject({
      schemaVersion: 1,
      passed: true,
    });
  });

  it('uses exit code one for failed verification', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(
      root,
      '---\ntitle: Home\n---\n\n# Home\n\n[Missing](missing.md)\n',
    );
    const output = captureIo();

    const exitCode = await main(
      ['verify', '-c', configPath, '--now', '2026-08-27'],
      output.io,
    );

    expect(exitCode).toBe(1);
    expect(output.stdout.join('')).toContain('CCE002');
  });

  it('allows render failure thresholds to be overridden explicitly', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(
      root,
      '---\ntitle: Home\nreviewBy: 2026-09-01\n---\n\n# Home\n',
    );
    const output = captureIo();

    const exitCode = await main(
      [
        'render',
        '--config',
        configPath,
        '--fail-on',
        'warning',
        '--now',
        '2026-08-27',
      ],
      output.io,
    );

    expect(exitCode).toBe(1);
    expect(output.stdout.join('')).toContain('CCE007');
  });

  it('uses exit code two for invalid commands and arguments', async () => {
    const unknown = captureIo();
    const invalidDate = captureIo();
    const invalidCalendarDate = captureIo();

    expect(await main(['unknown'], unknown.io)).toBe(2);
    expect(unknown.stderr.join('')).toContain('COMMAND_UNKNOWN');
    expect(
      await main(
        [
          'verify',
          '--config',
          path.join('missing', 'config.json'),
          '--now',
          'not-a-date',
        ],
        invalidDate.io,
      ),
    ).toBe(2);
    expect(invalidDate.stderr.join('')).toContain('NOW_INVALID');
    expect(
      await main(['verify', '--now', '2026-02-31'], invalidCalendarDate.io),
    ).toBe(2);
    expect(invalidCalendarDate.stderr.join('')).toContain('NOW_INVALID');
  });

  it('explains stable rule identifiers', async () => {
    const output = captureIo();

    expect(await main(['explain', 'CCE004'], output.io)).toBe(0);
    expect(output.stdout.join('')).toContain('fact-unknown');
  });

  it('initializes and renders a project through the CLI', async () => {
    const root = await createTemporaryProject();
    const initialized = captureIo();
    const rendered = captureIo();

    expect(await main(['init', root], initialized.io)).toBe(0);
    expect(initialized.stdout.join('')).toContain('Initialized');
    expect(
      await main(
        [
          'render',
          '--config',
          path.join(root, 'content-contract.config.json'),
          '--now',
          '2026-08-27',
        ],
        rendered.io,
      ),
    ).toBe(0);
    expect(rendered.stdout.join('')).toContain('Rendered 2 file(s)');
  });

  it('reports invalid formats, thresholds, and rule requests', async () => {
    const badFormat = captureIo();
    const badInitFormat = captureIo();
    const badThreshold = captureIo();
    const badRenderThreshold = captureIo();
    const missingRule = captureIo();
    const unknownRule = captureIo();

    expect(await main(['verify', '--format', 'xml'], badFormat.io)).toBe(2);
    expect(badFormat.stderr.join('')).toContain('FORMAT_INVALID');
    const initRoot = await createTemporaryProject();
    expect(
      await main(['init', initRoot, '--format', 'xml'], badInitFormat.io),
    ).toBe(2);
    expect(badInitFormat.stderr.join('')).toContain('FORMAT_INVALID');
    expect(
      await main(['verify', '--fail-on', 'critical'], badThreshold.io),
    ).toBe(2);
    expect(badThreshold.stderr.join('')).toContain('FAILURE_THRESHOLD_INVALID');
    expect(
      await main(['render', '--fail-on', 'never'], badRenderThreshold.io),
    ).toBe(2);
    expect(badRenderThreshold.stderr.join('')).toContain(
      'RENDER_THRESHOLD_INVALID',
    );
    expect(await main(['explain'], missingRule.io)).toBe(2);
    expect(missingRule.stderr.join('')).toContain('RULE_ARGUMENTS_INVALID');
    expect(await main(['explain', 'unknown'], unknownRule.io)).toBe(2);
    expect(unknownRule.stderr.join('')).toContain('RULE_UNKNOWN');
  });

  it('rejects extra positional arguments', async () => {
    const init = captureIo();
    const explain = captureIo();

    expect(await main(['init', 'one', 'two'], init.io)).toBe(2);
    expect(init.stderr.join('')).toContain('INIT_ARGUMENTS_INVALID');
    expect(await main(['explain', 'CCE001', 'extra'], explain.io)).toBe(2);
    expect(explain.stderr.join('')).toContain('RULE_ARGUMENTS_INVALID');
  });
});
