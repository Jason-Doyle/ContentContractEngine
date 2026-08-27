import {
  lstat,
  mkdir,
  readFile,
  rename,
  rm,
  rmdir,
  writeFile,
} from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import type {
  ContentProject,
  RenderExecution,
  RenderResult,
  VerificationOptions,
} from './types.js';
import { ContentContractError, errorMessage } from './errors.js';
import { renderFact } from './facts.js';
import {
  assertNoSymlinkSegments,
  isInsidePath,
  relativeProjectPath,
  resolveInside,
} from './paths.js';
import { loadProject } from './project.js';
import { verifyProject } from './verify.js';

const manifestFileName = '.content-contract-manifest.json';

interface RenderManifest {
  schemaVersion: 1;
  files: string[];
}

export async function render(
  configPath?: string,
  options: VerificationOptions = {},
): Promise<RenderExecution> {
  const project = await loadProject(configPath);
  const requestedThreshold = options.failOn ?? project.config.gate.failOn;
  const verification = await verifyProject(project, {
    ...options,
    failOn: requestedThreshold === 'warning' ? 'warning' : 'error',
  });
  if (!verification.passed) {
    return { schemaVersion: 1, verification, render: null };
  }

  return {
    schemaVersion: 1,
    verification,
    render: await renderProject(project),
  };
}

export async function renderProject(
  project: ContentProject,
): Promise<RenderResult> {
  const outputDirectory = project.config.render.outputDirectory;
  await assertNoSymlinkSegments(
    project.config.rootDirectory,
    outputDirectory,
    'Render output directory',
  );
  await assertNoSymlinkSegments(
    project.config.rootDirectory,
    path.join(outputDirectory, manifestFileName),
    'Render manifest',
  );
  const previousManifest = await readManifest(outputDirectory);
  const plannedFiles = await Promise.all(
    project.documents.map(async (document) => {
      const outputPath = resolveInside(
        outputDirectory,
        document.relativePath,
        `Rendered path for ${document.relativePath}`,
      );
      if (!isInsidePath(outputDirectory, outputPath)) {
        throw new ContentContractError(
          'RENDER_PATH_UNSAFE',
          `Rendered path escaped the output directory: ${document.relativePath}`,
        );
      }
      await assertNoSymlinkSegments(
        project.config.rootDirectory,
        outputPath,
        `Rendered path for ${document.relativePath}`,
      );
      return {
        document,
        outputPath,
        relativePath: relativeProjectPath(outputDirectory, outputPath),
      };
    }),
  );

  const currentFiles = new Set(
    plannedFiles.map((planned) => planned.relativePath),
  );
  const removedFiles: string[] = [];
  for (const staleFile of previousManifest.files) {
    if (currentFiles.has(staleFile)) {
      continue;
    }
    const stalePath = resolveInside(
      outputDirectory,
      staleFile,
      `Stale rendered path ${staleFile}`,
    );
    await assertNoSymlinkSegments(
      project.config.rootDirectory,
      stalePath,
      `Stale rendered path ${staleFile}`,
    );
    const staleStatus = await readStaleStatus(stalePath);
    if (staleStatus === null) {
      continue;
    }
    if (!staleStatus.isFile()) {
      throw new ContentContractError(
        'RENDER_MANIFEST_ENTRY_INVALID',
        `Render manifest entry is not a file: ${staleFile}`,
      );
    }
    await rm(stalePath, { force: true });
    await removeEmptyParents(path.dirname(stalePath), outputDirectory);
    removedFiles.push(staleFile);
  }

  for (const planned of plannedFiles) {
    const rendered = renderDocument(project, planned.document);
    await mkdir(path.dirname(planned.outputPath), { recursive: true });
    await atomicWrite(planned.outputPath, rendered);
  }

  const sortedFiles = plannedFiles
    .map((planned) => planned.relativePath)
    .sort((left, right) => left.localeCompare(right, 'en'));
  await mkdir(outputDirectory, { recursive: true });
  await atomicWrite(
    path.join(outputDirectory, manifestFileName),
    `${JSON.stringify(
      { schemaVersion: 1, files: sortedFiles } satisfies RenderManifest,
      null,
      2,
    )}\n`,
  );

  return {
    outputDirectory,
    files: sortedFiles,
    removedFiles: removedFiles.sort((left, right) =>
      left.localeCompare(right, 'en'),
    ),
  };
}

async function readStaleStatus(
  stalePath: string,
): Promise<Awaited<ReturnType<typeof lstat>> | null> {
  try {
    return await lstat(stalePath);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw new ContentContractError(
      'RENDER_STALE_INSPECTION_FAILED',
      `Unable to inspect stale rendered path ${stalePath}: ${errorMessage(error)}`,
      { cause: error },
    );
  }
}

async function removeEmptyParents(
  startingDirectory: string,
  outputDirectory: string,
): Promise<void> {
  let current = startingDirectory;
  while (
    current !== outputDirectory &&
    isInsidePath(outputDirectory, current)
  ) {
    try {
      await rmdir(current);
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        (error.code === 'ENOENT' ||
          error.code === 'ENOTEMPTY' ||
          error.code === 'EEXIST')
      ) {
        return;
      }
      throw new ContentContractError(
        'RENDER_DIRECTORY_CLEANUP_FAILED',
        `Unable to remove empty render directory ${current}: ${errorMessage(error)}`,
        { cause: error },
      );
    }
    current = path.dirname(current);
  }
}

function renderDocument(
  project: ContentProject,
  document: ContentProject['documents'][number],
): string {
  let rendered = '';
  let cursor = 0;

  for (const reference of document.factReferences) {
    rendered += document.sourceText.slice(cursor, reference.startOffset);
    const fact = project.facts.facts[reference.key];
    if (!fact) {
      throw new ContentContractError(
        'RENDER_FACT_UNKNOWN',
        `Cannot render unknown fact "${reference.key}" in ${document.relativePath}.`,
      );
    }
    rendered += renderFact(fact);
    cursor = reference.endOffset;
  }

  return rendered + document.sourceText.slice(cursor);
}

async function readManifest(outputDirectory: string): Promise<RenderManifest> {
  const manifestPath = path.join(outputDirectory, manifestFileName);
  let source: string;
  try {
    source = await readFile(manifestPath, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return { schemaVersion: 1, files: [] };
    }
    throw new ContentContractError(
      'RENDER_MANIFEST_READ_FAILED',
      `Unable to read ${manifestPath}: ${errorMessage(error)}`,
      { cause: error },
    );
  }

  try {
    const parsed = JSON.parse(source) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('schemaVersion' in parsed) ||
      parsed.schemaVersion !== 1 ||
      !('files' in parsed) ||
      !Array.isArray(parsed.files) ||
      !parsed.files.every((file) => typeof file === 'string')
    ) {
      throw new Error('Unexpected manifest structure.');
    }
    return { schemaVersion: 1, files: [...parsed.files] };
  } catch (error) {
    throw new ContentContractError(
      'RENDER_MANIFEST_INVALID',
      `Invalid render manifest ${manifestPath}: ${errorMessage(error)}`,
      { cause: error },
    );
  }
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, content, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    await rename(temporaryPath, filePath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw new ContentContractError(
      'RENDER_WRITE_FAILED',
      `Unable to write ${filePath}: ${errorMessage(error)}`,
      { cause: error },
    );
  }
}
