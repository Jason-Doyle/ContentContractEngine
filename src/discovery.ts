import { readFile } from 'node:fs/promises';
import path from 'node:path';

import fg from 'fast-glob';

import type {
  ContentDocument,
  ResolvedProjectConfig,
  ResolvedSource,
} from './types.js';
import { ContentContractError, errorMessage } from './errors.js';
import { parseFrontmatter } from './frontmatter.js';
import { parseMarkdown } from './markdown.js';
import {
  assertExistingPathInside,
  isInsidePath,
  relativeProjectPath,
  toPosixPath,
} from './paths.js';

const defaultIgnores = ['**/.git/**', '**/node_modules/**'];

export async function discoverDocuments(
  config: ResolvedProjectConfig,
): Promise<ContentDocument[]> {
  const documentSources = new Map<string, ResolvedSource>();
  const outputRelative = relativeProjectPath(
    config.rootDirectory,
    config.render.outputDirectory,
  );

  for (const source of config.sources) {
    const matches = await fg(source.include, {
      absolute: true,
      cwd: config.rootDirectory,
      dot: true,
      followSymbolicLinks: false,
      ignore: [
        ...defaultIgnores,
        `${fg.escapePath(outputRelative)}/**`,
        ...source.exclude,
      ],
      onlyFiles: true,
      unique: true,
    });
    const sourceMatches = matches.filter(
      (absolutePath) =>
        !isInsidePath(
          config.render.outputDirectory,
          path.resolve(absolutePath),
        ),
    );
    if (sourceMatches.length === 0 && !source.allowEmpty) {
      throw new ContentContractError(
        'SOURCE_EMPTY',
        `Source "${source.id}" did not match any files. Correct the include patterns or set allowEmpty to true.`,
      );
    }

    for (const absolutePath of sourceMatches.sort((left, right) =>
      left.localeCompare(right, 'en'),
    )) {
      const normalized = path.resolve(absolutePath);
      const existing = documentSources.get(normalized);
      if (existing) {
        throw new ContentContractError(
          'SOURCE_OVERLAP',
          `${relativeProjectPath(config.rootDirectory, normalized)} matches both "${existing.id}" and "${source.id}".`,
        );
      }
      documentSources.set(normalized, source);
    }
  }

  const documents = await Promise.all(
    [...documentSources.entries()].map(async ([absolutePath, source]) =>
      loadDocument(config, source, absolutePath),
    ),
  );

  return documents.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath, 'en'),
  );
}

async function loadDocument(
  config: ResolvedProjectConfig,
  source: ResolvedSource,
  absolutePath: string,
): Promise<ContentDocument> {
  const extension = path.extname(absolutePath).toLowerCase();
  if (extension !== '.md' && extension !== '.mdx') {
    throw new ContentContractError(
      'DOCUMENT_TYPE_UNSUPPORTED',
      `Unsupported content type for ${absolutePath}. Initial releases support .md and .mdx.`,
    );
  }

  let sourceText: string;
  try {
    await assertExistingPathInside(
      config.rootDirectory,
      absolutePath,
      'Content document',
    );
    sourceText = await readFile(absolutePath, 'utf8');
  } catch (error) {
    throw new ContentContractError(
      'DOCUMENT_READ_FAILED',
      `Unable to read ${absolutePath}: ${errorMessage(error)}`,
      { cause: error },
    );
  }

  const relativePath = relativeProjectPath(config.rootDirectory, absolutePath);
  const frontmatter = parseFrontmatter(sourceText, relativePath);
  const markdown = parseMarkdown(
    sourceText,
    frontmatter.body,
    relativePath,
    frontmatter.bodyOffset,
    frontmatter.bodyStartLine,
    extension === '.mdx',
  );

  return {
    sourceId: source.id,
    absolutePath,
    relativePath: toPosixPath(relativePath),
    sourceText,
    body: frontmatter.body,
    bodyOffset: frontmatter.bodyOffset,
    bodyStartLine: frontmatter.bodyStartLine,
    frontmatter: frontmatter.frontmatter,
    headings: markdown.headings,
    anchors: markdown.anchors,
    links: markdown.links,
    factReferences: markdown.factReferences,
  };
}
