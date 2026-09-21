import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import type {
  BaselineEntry,
  BaselineFile,
  BaselineResult,
  ContentProject,
  Finding,
  ResolvedProjectConfig,
} from './types.js';
import { ContentContractError, errorMessage } from './errors.js';
import {
  assertExistingPathInside,
  assertNoSymlinkSegments,
  isInsidePath,
  relativeProjectPath,
} from './paths.js';
import { publishedSchemaUrl } from './schema-urls.js';
import { compileSchema, formatSchemaErrors, readJsonFile } from './schema.js';

const bundledBaselineSchemaPath = fileURLToPath(
  new URL('../schemas/baseline.schema.json', import.meta.url),
);

export async function loadBaseline(
  config: ResolvedProjectConfig,
): Promise<readonly BaselineEntry[]> {
  if (!config.baselineFilePath) {
    return [];
  }

  try {
    await assertExistingPathInside(
      config.rootDirectory,
      config.baselineFilePath,
      'Baseline file',
    );
  } catch (error) {
    if (isMissingFile(error)) {
      throw new ContentContractError(
        'BASELINE_FILE_MISSING',
        `Baseline file does not exist: ${config.baselineFilePath}. Run content-contract baseline to create it.`,
        { cause: error },
      );
    }
    throw error;
  }

  const [rawBaseline, baselineSchema] = await Promise.all([
    readJsonFile(config.baselineFilePath),
    readJsonFile(bundledBaselineSchemaPath),
  ]);
  const validate = compileSchema(baselineSchema, bundledBaselineSchemaPath);
  if (!validate(rawBaseline)) {
    throw new ContentContractError(
      'BASELINE_INVALID',
      `Invalid baseline in ${config.baselineFilePath}: ${formatSchemaErrors(validate.errors)}`,
    );
  }

  return (rawBaseline as BaselineFile).findings;
}

export function applyBaseline(
  findings: readonly Finding[],
  baseline: readonly BaselineEntry[],
): {
  findings: Finding[];
  suppressed: number;
} {
  const available = new Map<string, number>();
  for (const entry of baseline) {
    const key = baselineKey(entry);
    available.set(key, (available.get(key) ?? 0) + 1);
  }

  const active: Finding[] = [];
  let suppressed = 0;
  for (const finding of findings) {
    const key = baselineKey(finding);
    const remaining = available.get(key) ?? 0;
    if (remaining > 0) {
      available.set(key, remaining - 1);
      suppressed += 1;
    } else {
      active.push(finding);
    }
  }

  return { findings: active, suppressed };
}

export async function writeBaseline(
  project: ContentProject,
  findings: readonly Finding[],
): Promise<BaselineResult> {
  const { config } = project;
  const filePath = config.baselineFilePath;
  if (!filePath) {
    throw new ContentContractError(
      'BASELINE_NOT_CONFIGURED',
      'Configure baseline.file before creating a baseline.',
    );
  }

  assertSafeBaselinePath(project, filePath);
  await assertNoSymlinkSegments(
    config.rootDirectory,
    filePath,
    'Baseline file',
  );
  await mkdir(path.dirname(filePath), { recursive: true });

  const baseline: BaselineFile = {
    $schema: publishedSchemaUrl('baseline.schema.json'),
    version: 1,
    findings: findings.map(({ ruleId, file, location, message }) => ({
      ruleId,
      file,
      ...(location ? { location } : {}),
      message,
    })),
  };
  await atomicWrite(filePath, `${JSON.stringify(baseline, null, 2)}\n`);

  return {
    file: relativeProjectPath(config.rootDirectory, filePath),
    entries: baseline.findings.length,
  };
}

function assertSafeBaselinePath(
  project: ContentProject,
  filePath: string,
): void {
  const protectedPaths = new Set([
    project.config.configPath,
    ...(project.config.factsFilePath ? [project.config.factsFilePath] : []),
    ...project.config.sources.flatMap((source) =>
      source.frontmatterSchemaPath ? [source.frontmatterSchemaPath] : [],
    ),
    ...project.documents.map((document) => document.absolutePath),
  ]);
  if (
    samePath(filePath, project.config.rootDirectory) ||
    [...protectedPaths].some((protectedPath) =>
      samePath(filePath, protectedPath),
    ) ||
    isInsidePath(project.config.render.outputDirectory, filePath)
  ) {
    throw new ContentContractError(
      'BASELINE_PATH_UNSAFE',
      `Baseline file would overwrite project input or generated output: ${filePath}`,
    );
  }
}

function samePath(left: string, right: string): boolean {
  return path.relative(left, right) === '';
}

function baselineKey(entry: BaselineEntry): string {
  return JSON.stringify([
    entry.ruleId,
    entry.file,
    entry.location?.line ?? null,
    entry.location?.column ?? null,
    entry.location?.endLine ?? null,
    entry.location?.endColumn ?? null,
    entry.message,
  ]);
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
      'BASELINE_WRITE_FAILED',
      `Unable to write ${filePath}: ${errorMessage(error)}`,
      { cause: error },
    );
  }
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
