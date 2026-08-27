import path from 'node:path';
import { lstat, realpath } from 'node:fs/promises';

import { ContentContractError } from './errors.js';

export function toPosixPath(value: string): string {
  return value.split(path.sep).join('/');
}

export function isInsidePath(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== '..' &&
      !path.isAbsolute(relative))
  );
}

export function resolveInside(
  rootDirectory: string,
  value: string,
  label: string,
): string {
  const resolved = path.resolve(rootDirectory, value);
  if (!isInsidePath(rootDirectory, resolved)) {
    throw new ContentContractError(
      'PATH_OUTSIDE_PROJECT',
      `${label} must resolve inside ${rootDirectory}: ${value}`,
    );
  }

  return resolved;
}

export function relativeProjectPath(
  rootDirectory: string,
  absolutePath: string,
): string {
  return toPosixPath(path.relative(rootDirectory, absolutePath));
}

export async function assertExistingPathInside(
  rootDirectory: string,
  candidate: string,
  label: string,
): Promise<void> {
  const [realRoot, realCandidate] = await Promise.all([
    realpath(rootDirectory),
    realpath(candidate),
  ]);
  if (!isInsidePath(realRoot, realCandidate)) {
    throw new ContentContractError(
      'SYMLINK_OUTSIDE_PROJECT',
      `${label} resolves outside ${rootDirectory}: ${candidate}`,
    );
  }
}

export async function isExistingRealPathInside(
  rootDirectory: string,
  candidate: string,
): Promise<boolean> {
  try {
    await assertExistingPathInside(rootDirectory, candidate, 'Path');
    return true;
  } catch {
    return false;
  }
}

export async function assertNoSymlinkSegments(
  rootDirectory: string,
  candidate: string,
  label: string,
): Promise<void> {
  if (!isInsidePath(rootDirectory, candidate)) {
    throw new ContentContractError(
      'PATH_OUTSIDE_PROJECT',
      `${label} must remain inside ${rootDirectory}: ${candidate}`,
    );
  }

  const relative = path.relative(rootDirectory, candidate);
  let current = rootDirectory;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      const status = await lstat(current);
      if (status.isSymbolicLink()) {
        throw new ContentContractError(
          'SYMLINK_WRITE_BLOCKED',
          `${label} traverses a symbolic link: ${current}`,
        );
      }
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return;
      }
      throw error;
    }
  }
}
