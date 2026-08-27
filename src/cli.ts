#!/usr/bin/env node

import { parseArgs } from 'node:util';

import type { FailureThreshold } from './types.js';
import { ContentContractError, errorMessage } from './errors.js';
import { initializeProject } from './init.js';
import { render } from './render.js';
import {
  formatInit,
  formatJson,
  formatRender,
  formatRule,
  formatVerification,
} from './reporters.js';
import { findRule } from './rules.js';
import { verify } from './verify.js';
import { version } from './version.js';

export { version };

export interface CliIo {
  stdout: (value: string) => void;
  stderr: (value: string) => void;
}

const defaultIo: CliIo = {
  stdout: (value) => {
    process.stdout.write(value.endsWith('\n') ? value : `${value}\n`);
  },
  stderr: (value) => {
    process.stderr.write(value.endsWith('\n') ? value : `${value}\n`);
  },
};

export async function main(
  args = process.argv.slice(2),
  io: CliIo = defaultIo,
): Promise<number> {
  try {
    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
      io.stdout(helpText());
      return 0;
    }
    if (args.includes('--version') || args.includes('-v')) {
      io.stdout(version);
      return 0;
    }

    const [command, ...commandArgs] = args;
    switch (command) {
      case 'init':
        return await runInit(commandArgs, io);
      case 'verify':
        return await runVerify(commandArgs, io);
      case 'render':
        return await runRender(commandArgs, io);
      case 'explain':
        return runExplain(commandArgs, io);
      default:
        throw new ContentContractError(
          'COMMAND_UNKNOWN',
          `Unknown command "${command ?? ''}". Run content-contract --help.`,
        );
    }
  } catch (error) {
    const prefix =
      error instanceof ContentContractError ? `${error.code}: ` : '';
    io.stderr(`${prefix}${errorMessage(error)}`);
    return 2;
  }
}

async function runInit(args: string[], io: CliIo): Promise<number> {
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      force: {
        type: 'boolean',
        default: false,
      },
      format: {
        type: 'string',
        default: 'pretty',
      },
    },
  });
  if (parsed.positionals.length > 1) {
    throw new ContentContractError(
      'INIT_ARGUMENTS_INVALID',
      'The init command accepts at most one directory.',
    );
  }
  const directory = parsed.positionals[0] ?? '.';
  const format = parseFormat(parsed.values.format);
  const result = await initializeProject(directory, parsed.values.force);
  io.stdout(format === 'json' ? formatJson(result) : formatInit(result));
  return 0;
}

async function runVerify(args: string[], io: CliIo): Promise<number> {
  const parsed = parseArgs({
    args,
    allowPositionals: false,
    strict: true,
    options: commonVerificationOptions(),
  });
  const format = parseFormat(parsed.values.format);
  const failOn = parseFailureThreshold(parsed.values['fail-on']);
  const now = parseNow(parsed.values.now);
  const result = await verify(parsed.values.config, {
    ...(failOn ? { failOn } : {}),
    ...(now ? { now } : {}),
  });
  io.stdout(
    format === 'json' ? formatJson(result) : formatVerification(result),
  );
  return result.passed ? 0 : 1;
}

async function runRender(args: string[], io: CliIo): Promise<number> {
  const parsed = parseArgs({
    args,
    allowPositionals: false,
    strict: true,
    options: commonVerificationOptions(),
  });
  const format = parseFormat(parsed.values.format);
  const failOn = parseFailureThreshold(parsed.values['fail-on']);
  if (failOn === 'never') {
    throw new ContentContractError(
      'RENDER_THRESHOLD_INVALID',
      'Render requires --fail-on error or warning because errors cannot produce valid output.',
    );
  }
  const now = parseNow(parsed.values.now);
  const execution = await render(parsed.values.config, {
    ...(failOn ? { failOn } : {}),
    ...(now ? { now } : {}),
  });

  if (!execution.verification.passed || !execution.render) {
    io.stdout(
      format === 'json'
        ? formatJson(execution)
        : formatVerification(execution.verification),
    );
    return 1;
  }

  io.stdout(
    format === 'json'
      ? formatJson(execution)
      : [
          formatVerification(execution.verification),
          formatRender(execution.render),
        ].join('\n'),
  );
  return 0;
}

function runExplain(args: string[], io: CliIo): number {
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      format: {
        type: 'string',
        default: 'pretty',
      },
    },
  });
  if (parsed.positionals.length !== 1) {
    throw new ContentContractError(
      'RULE_ARGUMENTS_INVALID',
      'The explain command requires exactly one rule ID or rule name.',
    );
  }
  const identifier = parsed.positionals[0];
  if (!identifier) {
    throw new ContentContractError(
      'RULE_ARGUMENTS_INVALID',
      'The explain command requires exactly one rule ID or rule name.',
    );
  }
  const rule = findRule(identifier);
  if (!rule) {
    throw new ContentContractError(
      'RULE_UNKNOWN',
      `Unknown rule "${identifier}".`,
    );
  }

  io.stdout(
    parseFormat(parsed.values.format) === 'json'
      ? formatJson(rule)
      : formatRule(rule),
  );
  return 0;
}

function commonVerificationOptions() {
  return {
    config: {
      type: 'string' as const,
      short: 'c',
    },
    format: {
      type: 'string' as const,
      default: 'pretty',
    },
    'fail-on': {
      type: 'string' as const,
    },
    now: {
      type: 'string' as const,
    },
  };
}

function parseFormat(value: string | undefined): 'pretty' | 'json' {
  if (value === undefined || value === 'pretty' || value === 'json') {
    return value ?? 'pretty';
  }
  throw new ContentContractError(
    'FORMAT_INVALID',
    `Unsupported format "${value}". Use "pretty" or "json".`,
  );
}

function parseFailureThreshold(
  value: string | undefined,
): FailureThreshold | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === 'error' || value === 'warning' || value === 'never') {
    return value;
  }
  throw new ContentContractError(
    'FAILURE_THRESHOLD_INVALID',
    `Unsupported failure threshold "${value}".`,
  );
}

function parseNow(value: string | undefined): Date | undefined {
  if (value === undefined) {
    return undefined;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) {
    throw new ContentContractError(
      'NOW_INVALID',
      `Invalid --now value "${value}". Use YYYY-MM-DD.`,
    );
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new ContentContractError(
      'NOW_INVALID',
      `Invalid --now value "${value}".`,
    );
  }
  return parsed;
}

function helpText(): string {
  return [
    'Content Contract Engine',
    '',
    'Usage:',
    '  content-contract init [directory] [--force] [--format pretty|json]',
    '  content-contract verify [-c path] [--fail-on error|warning|never]',
    '                          [--now YYYY-MM-DD] [--format pretty|json]',
    '  content-contract render [-c path] [--fail-on error|warning]',
    '                          [--now YYYY-MM-DD]',
    '                          [--format pretty|json]',
    '  content-contract explain <rule-id|rule-name> [--format pretty|json]',
    '',
    'Exit codes:',
    '  0  command succeeded or verification passed',
    '  1  verification failed',
    '  2  configuration or command error',
  ].join('\n');
}
