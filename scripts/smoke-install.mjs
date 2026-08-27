import { mkdtemp, readFile, rm } from 'node:fs/promises';
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
