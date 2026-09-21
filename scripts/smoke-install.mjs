import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const npmCli = process.env.npm_execpath;
if (!npmCli) {
  throw new Error('npm_execpath is unavailable.');
}

const packageMetadata = JSON.parse(
  await readFile(path.join(projectRoot, 'package.json'), 'utf8'),
);
const temporaryDirectory = await mkdtemp(
  path.join(os.tmpdir(), 'content-contract-install-'),
);
let packagePath;

try {
  await writeFile(
    path.join(temporaryDirectory, 'package.json'),
    `${JSON.stringify({ private: true, type: 'module' }, null, 2)}\n`,
    'utf8',
  );
  const packed = runNode([npmCli, 'pack', '--json'], projectRoot, 'npm pack');
  const packResult = JSON.parse(packed.stdout);
  const filename = packResult[0]?.filename;
  if (typeof filename !== 'string') {
    throw new Error('npm pack did not return a package filename.');
  }
  packagePath = path.join(projectRoot, filename);

  runNode(
    [
      npmCli,
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      packagePath,
    ],
    temporaryDirectory,
    'npm install',
  );

  const versionResult = runInstalled(['--version'], 'installed --version');
  if (versionResult.stdout.trim() !== packageMetadata.version) {
    throw new Error(
      `Installed CLI returned ${JSON.stringify(versionResult.stdout.trim())}, expected ${JSON.stringify(packageMetadata.version)}.`,
    );
  }

  const demoDirectory = path.join(temporaryDirectory, 'demo');
  runInstalled(['init', demoDirectory], 'installed init');
  runInstalled(
    [
      'verify',
      '--config',
      path.join(demoDirectory, 'content-contract.config.json'),
      '--now',
      '2026-08-27',
    ],
    'installed verify',
  );

  await writeFile(
    path.join(temporaryDirectory, 'consumer.mjs'),
    [
      "import { findRule, rules } from 'content-contract-engine';",
      '',
      "if (findRule('CCE002') !== rules.linkTargetMissing) {",
      "  throw new Error('Installed library exports are unavailable.');",
      '}',
      '',
    ].join('\n'),
    'utf8',
  );
  runNode(
    [path.join(temporaryDirectory, 'consumer.mjs')],
    temporaryDirectory,
    'installed library import',
  );

  await writeFile(
    path.join(temporaryDirectory, 'consumer.ts'),
    [
      "import { verify, type ContentValidator, type VerificationResult } from 'content-contract-engine';",
      '',
      'const validator: ContentValidator = {',
      "  name: 'consumer-validator',",
      '  validate: () => [],',
      '};',
      'const result: Promise<VerificationResult> = verify(',
      "  './content-contract.config.json',",
      '  { validators: [validator] },',
      ');',
      'void result;',
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    path.join(temporaryDirectory, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          noEmit: true,
          skipLibCheck: false,
          strict: true,
          target: 'ES2022',
        },
        include: ['consumer.ts'],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  runNode(
    [
      npmCli,
      'exec',
      '--offline',
      '--',
      'tsc',
      '--project',
      path.join(temporaryDirectory, 'tsconfig.json'),
    ],
    projectRoot,
    'installed TypeScript declarations',
  );
} finally {
  if (packagePath) {
    await rm(packagePath, { force: true });
  }
  await rm(temporaryDirectory, { force: true, recursive: true });
}

function runNode(args, cwd, label) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
  });
  assertSuccess(result, label);
  return result;
}

function runInstalled(args, label) {
  return runNode(
    [npmCli, 'exec', '--offline', '--', 'content-contract', ...args],
    temporaryDirectory,
    label,
  );
}

function assertSuccess(result, label) {
  if (result.error) {
    throw new Error(`${label} could not start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    if (result.stdout) {
      process.stderr.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    throw new Error(`${label} failed with status ${String(result.status)}.`);
  }
}
