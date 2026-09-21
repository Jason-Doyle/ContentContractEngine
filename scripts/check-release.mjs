import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const metadata = JSON.parse(
  await readFile(path.join(projectRoot, 'package.json'), 'utf8'),
);
const expectedTag = `v${metadata.version}`;
const requestedTag = process.argv[2];
const failures = [];

if (metadata.private === true) {
  failures.push('package.json must not set private to true');
}
if (metadata.publishConfig?.access !== 'public') {
  failures.push('package.json must publish with public access');
}
if (requestedTag && requestedTag !== expectedTag) {
  failures.push(
    `release tag ${requestedTag} does not match package version ${expectedTag}`,
  );
}

const changelog = await readFile(
  path.join(projectRoot, 'CHANGELOG.md'),
  'utf8',
);
const escapedVersion = metadata.version.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
if (
  !new RegExp(`^## ${escapedVersion} - \\d{4}-\\d{2}-\\d{2}$`, 'mu').test(
    changelog,
  )
) {
  failures.push(`CHANGELOG.md has no dated ${metadata.version} release`);
}

const schemaNames = [
  'baseline.schema.json',
  'content-contract.config.schema.json',
  'facts.schema.json',
  'render-execution.schema.json',
  'verification-result.schema.json',
];
for (const schemaName of schemaNames) {
  const schema = JSON.parse(
    await readFile(path.join(projectRoot, 'schemas', schemaName), 'utf8'),
  );
  const expectedId =
    `https://raw.githubusercontent.com/Jason-Doyle/ContentContractEngine/` +
    `${expectedTag}/schemas/${schemaName}`;
  if (schema.$id !== expectedId) {
    failures.push(`${schemaName} must use immutable ID ${expectedId}`);
  }
  if (
    metadata.exports?.[`./schemas/${schemaName}`] !== `./schemas/${schemaName}`
  ) {
    failures.push(`${schemaName} is missing from package exports`);
  }
}

if (failures.length > 0) {
  throw new Error(`Release checks failed:\n- ${failures.join('\n- ')}`);
}

process.stdout.write(
  `Release metadata is consistent for ${metadata.name}@${metadata.version}.\n`,
);
