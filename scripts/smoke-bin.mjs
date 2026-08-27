import { mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const temporaryDirectory = await mkdtemp(
  path.join(os.tmpdir(), 'content-contract-bin-'),
);
const packageMetadata = JSON.parse(
  await readFile(path.join(projectRoot, 'package.json'), 'utf8'),
);

try {
  let invokedPath;
  if (process.platform === 'win32') {
    const packageLink = path.join(temporaryDirectory, 'package');
    await symlink(projectRoot, packageLink, 'junction');
    invokedPath = path.join(packageLink, 'dist', 'bin.js');
  } else {
    invokedPath = path.join(temporaryDirectory, 'content-contract');
    await symlink(path.join(projectRoot, 'dist', 'bin.js'), invokedPath);
  }

  const result = spawnSync(process.execPath, [invokedPath, '--version'], {
    encoding: 'utf8',
  });
  if (result.status !== 0 || result.stdout.trim() !== packageMetadata.version) {
    process.stderr.write(result.stderr);
    throw new Error(
      `Bin smoke test failed with status ${String(result.status)} and output ${JSON.stringify(result.stdout)}.`,
    );
  }
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true });
}
