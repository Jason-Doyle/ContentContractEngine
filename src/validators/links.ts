import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import type {
  ContentDocument,
  ContentProject,
  Finding,
  LinkReference,
} from '../types.js';
import { rules } from '../rules.js';
import { ContentContractError, errorMessage } from '../errors.js';
import { parseFrontmatter } from '../frontmatter.js';
import { parseMarkdown } from '../markdown.js';
import {
  isExistingRealPathInside,
  isInsidePath,
  relativeProjectPath,
  toPosixPath,
} from '../paths.js';

const externalProtocol = /^[a-z][a-z0-9+.-]*:/iu;
type DirectoryCache = Map<string, Promise<readonly string[] | null>>;
type LinkedAnchorResult =
  { ok: true; anchors: ReadonlySet<string> } | { ok: false; error: string };
type AnchorCache = Map<string, Promise<LinkedAnchorResult>>;

export async function validateLinks(
  project: ContentProject,
): Promise<Finding[]> {
  const directoryCache: DirectoryCache = new Map();
  const anchorCache: AnchorCache = new Map();
  const results = await Promise.all(
    project.documents.flatMap((document) =>
      document.links.map((link) =>
        validateLink(project, document, link, directoryCache, anchorCache),
      ),
    ),
  );

  return results.filter((finding): finding is Finding => finding !== null);
}

async function validateLink(
  project: ContentProject,
  document: ContentDocument,
  link: LinkReference,
  directoryCache: DirectoryCache,
  anchorCache: AnchorCache,
): Promise<Finding | null> {
  const trimmedUrl = link.url.trim();
  if (
    trimmedUrl === '' ||
    trimmedUrl.startsWith('//') ||
    externalProtocol.test(trimmedUrl)
  ) {
    return null;
  }

  const [rawPath = '', rawFragment] = splitUrl(trimmedUrl);
  if (rawPath.includes('\\')) {
    return missingTargetFinding(
      document,
      link,
      `Link uses a Windows path separator; use "/": ${trimmedUrl}`,
    );
  }
  const decodedPath = safeDecode(rawPath);
  const decodedFragment = rawFragment
    ? safeDecode(rawFragment).replace(/^user-content-/u, '')
    : null;

  if (decodedPath === '') {
    return validateAnchor(document, decodedFragment, link);
  }

  const sourceDirectory = path.dirname(document.absolutePath);
  const targetBase = decodedPath.startsWith('/')
    ? path.resolve(project.config.rootDirectory, `.${decodedPath}`)
    : path.resolve(sourceDirectory, decodedPath);

  if (!isInsidePath(project.config.rootDirectory, targetBase)) {
    return missingTargetFinding(
      document,
      link,
      `Link target escapes the project root: ${trimmedUrl}`,
    );
  }
  if (isInsidePath(project.config.render.outputDirectory, targetBase)) {
    return missingTargetFinding(
      document,
      link,
      `Source content cannot link to generated render output: ${trimmedUrl}`,
    );
  }

  const candidates = buildCandidates(targetBase);
  for (const candidate of candidates) {
    const relative = relativeProjectPath(
      project.config.rootDirectory,
      candidate,
    );
    const targetDocument = project.documentsByPath.get(toPosixPath(relative));
    if (targetDocument) {
      return validateAnchor(targetDocument, decodedFragment, link, document);
    }

    if (
      await fileExistsWithExactCase(
        project.config.rootDirectory,
        candidate,
        directoryCache,
      )
    ) {
      if (decodedFragment && isMarkdownPath(candidate)) {
        const anchorResult = await loadLinkedAnchors(
          project.config.rootDirectory,
          candidate,
          anchorCache,
        );
        if (!anchorResult.ok) {
          const rule = rules.linkAnchorUnverifiable;
          return {
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.defaultSeverity,
            file: document.relativePath,
            location: link.location,
            message: `Unable to verify heading anchor in ${relative}: ${anchorResult.error}`,
            help: rule.help,
          };
        }
        return validateAnchorSet(
          anchorResult.anchors,
          relative,
          decodedFragment,
          link,
          document,
        );
      }
      return null;
    }
  }

  return missingTargetFinding(
    document,
    link,
    `Link target does not exist: ${trimmedUrl}`,
  );
}

function validateAnchor(
  target: ContentDocument,
  fragment: string | null,
  link: LinkReference,
  source = target,
): Finding | null {
  return validateAnchorSet(
    target.anchors,
    target.relativePath,
    fragment,
    link,
    source,
  );
}

function validateAnchorSet(
  anchors: ReadonlySet<string>,
  targetPath: string,
  fragment: string | null,
  link: LinkReference,
  source: ContentDocument,
): Finding | null {
  if (!fragment || anchors.has(fragment)) {
    return null;
  }

  const rule = rules.linkAnchorMissing;
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    severity: rule.defaultSeverity,
    file: source.relativePath,
    location: link.location,
    message: `Heading anchor "#${fragment}" does not exist in ${targetPath}.`,
    help: rule.help,
  };
}

function missingTargetFinding(
  document: ContentDocument,
  link: LinkReference,
  message: string,
): Finding {
  const rule = rules.linkTargetMissing;
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    severity: rule.defaultSeverity,
    file: document.relativePath,
    location: link.location,
    message,
    help: rule.help,
  };
}

function splitUrl(value: string): [string, string | undefined] {
  const hashIndex = value.indexOf('#');
  const beforeHash = hashIndex === -1 ? value : value.slice(0, hashIndex);
  const queryIndex = beforeHash.indexOf('?');
  const pathPart =
    queryIndex === -1 ? beforeHash : beforeHash.slice(0, queryIndex);
  if (hashIndex === -1) {
    return [pathPart, undefined];
  }
  return [pathPart, value.slice(hashIndex + 1)];
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function buildCandidates(targetBase: string): string[] {
  const extension = path.extname(targetBase);
  if (extension && !/^\.\d+$/u.test(extension)) {
    return [targetBase];
  }

  return [
    targetBase,
    `${targetBase}.md`,
    `${targetBase}.mdx`,
    path.join(targetBase, 'index.md'),
    path.join(targetBase, 'index.mdx'),
    path.join(targetBase, 'README.md'),
  ];
}

async function fileExistsWithExactCase(
  rootDirectory: string,
  targetPath: string,
  directoryCache: DirectoryCache,
): Promise<boolean> {
  if (!isInsidePath(rootDirectory, targetPath)) {
    return false;
  }

  const relative = path.relative(rootDirectory, targetPath);
  if (relative === '') {
    return false;
  }

  let current = rootDirectory;
  for (const segment of relative.split(path.sep)) {
    const entries = await readDirectory(current, directoryCache);
    if (!entries) {
      return false;
    }
    if (!entries.includes(segment)) {
      return false;
    }
    current = path.join(current, segment);
  }

  try {
    const status = await stat(current);
    return (
      status.isFile() &&
      (await isExistingRealPathInside(rootDirectory, current))
    );
  } catch {
    return false;
  }
}

function readDirectory(
  directory: string,
  cache: DirectoryCache,
): Promise<readonly string[] | null> {
  const existing = cache.get(directory);
  if (existing) {
    return existing;
  }
  const pending = readdir(directory).catch(() => null);
  cache.set(directory, pending);
  return pending;
}

function isMarkdownPath(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  return extension === '.md' || extension === '.mdx';
}

function loadLinkedAnchors(
  rootDirectory: string,
  filePath: string,
  cache: AnchorCache,
): Promise<LinkedAnchorResult> {
  const existing = cache.get(filePath);
  if (existing) {
    return existing;
  }

  const pending = readLinkedAnchors(rootDirectory, filePath)
    .then((anchors): LinkedAnchorResult => ({ ok: true, anchors }))
    .catch((error: unknown): LinkedAnchorResult => ({
      ok: false,
      error: errorMessage(error),
    }));
  cache.set(filePath, pending);
  return pending;
}

async function readLinkedAnchors(
  rootDirectory: string,
  filePath: string,
): Promise<ReadonlySet<string>> {
  let source: string;
  try {
    source = await readFile(filePath, 'utf8');
  } catch (error) {
    throw new ContentContractError(
      'LINKED_DOCUMENT_READ_FAILED',
      `Unable to read linked document ${filePath}: ${errorMessage(error)}`,
      { cause: error },
    );
  }

  const relativePath = relativeProjectPath(rootDirectory, filePath);
  const frontmatter = parseFrontmatter(source, relativePath);
  return parseMarkdown(
    source,
    frontmatter.body,
    relativePath,
    frontmatter.bodyOffset,
    frontmatter.bodyStartLine,
    path.extname(filePath).toLowerCase() === '.mdx',
  ).anchors;
}
