import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const packageMetadata = JSON.parse(
  await readFile(path.join(projectRoot, 'package.json'), 'utf8'),
);
const npmCli = process.env.npm_execpath;
if (!npmCli) {
  throw new Error('npm_execpath is unavailable.');
}

const result = spawnSync(
  process.execPath,
  [npmCli, 'pack', '--dry-run', '--json'],
  {
    cwd: projectRoot,
    encoding: 'utf8',
  },
);
if (result.status !== 0) {
  process.stderr.write(result.stderr);
  throw new Error(`npm pack failed with status ${String(result.status)}.`);
}

const output = /** @type {unknown} */ (JSON.parse(result.stdout));
if (!isPackResult(output)) {
  throw new Error('npm pack returned an unexpected result.');
}

const files = new Set(output[0].files.map((entry) => entry.path));
const required = [
  'dist/bin.js',
  'dist/index.d.ts',
  'dist/index.js',
  'src/index.ts',
  'schemas/content-contract.config.schema.json',
  'schemas/facts.schema.json',
  'schemas/render-execution.schema.json',
  'schemas/verification-result.schema.json',
  'README.md',
  'LICENSE',
];
for (const requiredPath of required) {
  if (!files.has(requiredPath)) {
    throw new Error(`Package is missing ${requiredPath}.`);
  }
}

for (const packagedPath of files) {
  if (
    packagedPath.includes('/rendered/') ||
    packagedPath.startsWith('coverage/')
  ) {
    throw new Error(`Package contains generated output: ${packagedPath}.`);
  }
}

const runtimeDependencies = new Set(
  Object.keys(packageMetadata.dependencies ?? {}),
);
for (const declarationPath of files) {
  if (!declarationPath.endsWith('.d.ts')) {
    continue;
  }
  const declaration = await readFile(
    path.join(projectRoot, declarationPath),
    'utf8',
  );
  for (const match of declaration.matchAll(
    /(?:from\s+|import\()\s*['"]([^'"]+)['"]/gu,
  )) {
    const specifier = match[1];
    if (
      !specifier ||
      specifier.startsWith('.') ||
      specifier.startsWith('node:')
    ) {
      continue;
    }
    const packageName = specifier.startsWith('@')
      ? specifier.split('/').slice(0, 2).join('/')
      : specifier.split('/')[0];
    if (packageName && !runtimeDependencies.has(packageName)) {
      throw new Error(
        `${declarationPath} imports undeclared runtime type dependency ${packageName}.`,
      );
    }
  }
}

/**
 * @param {unknown} value
 * @returns {value is Array<{files: Array<{path: string}>}>}
 */
function isPackResult(value) {
  return (
    Array.isArray(value) &&
    value.length === 1 &&
    typeof value[0] === 'object' &&
    value[0] !== null &&
    'files' in value[0] &&
    Array.isArray(value[0].files) &&
    value[0].files.every(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        'path' in entry &&
        typeof entry.path === 'string',
    )
  );
}
