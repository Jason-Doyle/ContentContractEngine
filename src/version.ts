import { readFileSync } from 'node:fs';

export const version = readPackageVersion();

function readPackageVersion(): string {
  const parsed = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  ) as unknown;
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('version' in parsed) ||
    typeof parsed.version !== 'string'
  ) {
    throw new Error('package.json does not contain a valid version.');
  }
  return parsed.version;
}
