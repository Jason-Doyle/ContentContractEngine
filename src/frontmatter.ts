import { parseDocument } from 'yaml';

import { ContentContractError } from './errors.js';

export interface ParsedFrontmatter {
  frontmatter: Readonly<Record<string, unknown>>;
  body: string;
  bodyOffset: number;
  bodyStartLine: number;
}

const openingDelimiter = /^(?:\uFEFF)?---[ \t]*(?:\r?\n|$)/;
const closingDelimiter = /^(?:---|\.\.\.)[ \t]*$/;

export function parseFrontmatter(
  source: string,
  filePath: string,
): ParsedFrontmatter {
  const opening = openingDelimiter.exec(source);
  if (!opening) {
    return {
      frontmatter: Object.freeze({}),
      body: source,
      bodyOffset: 0,
      bodyStartLine: 1,
    };
  }

  const contentStart = opening[0].length;
  let cursor = contentStart;
  let closingStart = -1;
  let closingEnd = -1;

  while (cursor <= source.length) {
    const nextNewline = source.indexOf('\n', cursor);
    const lineEnd = nextNewline === -1 ? source.length : nextNewline;
    const line = source.slice(cursor, lineEnd).replace(/\r$/, '');
    if (closingDelimiter.test(line)) {
      closingStart = cursor;
      closingEnd = nextNewline === -1 ? lineEnd : nextNewline + 1;
      break;
    }
    if (nextNewline === -1) {
      break;
    }
    cursor = nextNewline + 1;
  }

  if (closingStart === -1) {
    throw new ContentContractError(
      'FRONTMATTER_UNTERMINATED',
      `Frontmatter in ${filePath} does not have a closing delimiter.`,
    );
  }

  const yamlText = source.slice(contentStart, closingStart);
  const yamlDocument = parseDocument(yamlText, { prettyErrors: false });
  if (yamlDocument.errors.length > 0) {
    throw new ContentContractError(
      'FRONTMATTER_YAML_INVALID',
      `Invalid frontmatter YAML in ${filePath}: ${yamlDocument.errors.map((error) => error.message).join('; ')}`,
    );
  }

  const parsed = yamlDocument.toJS() as unknown;
  if (
    parsed !== null &&
    (typeof parsed !== 'object' || Array.isArray(parsed))
  ) {
    throw new ContentContractError(
      'FRONTMATTER_NOT_OBJECT',
      `Frontmatter in ${filePath} must be a YAML mapping.`,
    );
  }

  const body = source.slice(closingEnd);
  const bodyStartLine = source.slice(0, closingEnd).split(/\r?\n/u).length;

  return {
    frontmatter: Object.freeze({
      ...((parsed ?? {}) as Record<string, unknown>),
    }),
    body,
    bodyOffset: closingEnd,
    bodyStartLine,
  };
}
