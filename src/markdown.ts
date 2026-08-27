import GithubSlugger from 'github-slugger';
import type { Definition, Heading, Node, Parent, Root } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

import type {
  FactReference,
  HeadingReference,
  LinkReference,
  SourceLocation,
} from './types.js';
import { ContentContractError, errorMessage } from './errors.js';

const factPattern = /\{\{fact:([a-z][a-z0-9_.-]*)\}\}/gu;

interface MdxJsxAttribute {
  type: 'mdxJsxAttribute';
  name: string;
  value: unknown;
}

interface MdxJsxNode extends Node {
  type: 'mdxJsxFlowElement' | 'mdxJsxTextElement';
  attributes: unknown[];
}

export interface ParsedMarkdown {
  headings: HeadingReference[];
  anchors: Set<string>;
  links: LinkReference[];
  factReferences: FactReference[];
}

export function parseMarkdown(
  sourceText: string,
  body: string,
  filePath: string,
  bodyOffset: number,
  bodyStartLine: number,
  mdx: boolean,
): ParsedMarkdown {
  const processor = unified().use(remarkParse).use(remarkGfm);
  if (mdx) {
    processor.use(remarkMdx);
  }

  let tree: Root;
  try {
    tree = processor.parse(body);
  } catch (error) {
    throw new ContentContractError(
      'MARKDOWN_INVALID',
      `Unable to parse ${filePath}: ${errorMessage(error)}`,
      { cause: error },
    );
  }

  const headings: HeadingReference[] = [];
  const anchors = new Set<string>();
  const links: LinkReference[] = [];
  const definitions = new Map<string, string>();
  const excludedFactRanges: Array<{ start: number; end: number }> = [];
  const slugger = new GithubSlugger();

  visit(tree, 'definition', (node: Definition) => {
    definitions.set(normalizeIdentifier(node.identifier), node.url);
  });

  visit(tree, 'heading', (node: Heading) => {
    const text = collectText(node);
    const slug = slugger.slug(text);
    anchors.add(slug);
    headings.push({
      text,
      slug,
      location: adjustLocation(node, bodyStartLine),
    });
  });

  visit(tree, 'html', (node: Node & { value?: string }) => {
    if (!node.value) {
      return;
    }

    for (const match of node.value.matchAll(
      /\s(?:id|name)=["']([^"']+)["']/giu,
    )) {
      const value = match[1];
      if (value) {
        anchors.add(value);
      }
    }
  });

  visit(tree, (node) => {
    if (
      isCodeLikeNode(node) &&
      node.position?.start.offset !== undefined &&
      node.position.end.offset !== undefined
    ) {
      excludedFactRanges.push({
        start: bodyOffset + node.position.start.offset,
        end: bodyOffset + node.position.end.offset,
      });
    }

    function isCodeLikeNode(node: Node): boolean {
      return (
        node.type === 'code' ||
        node.type === 'inlineCode' ||
        node.type === 'mdxFlowExpression' ||
        node.type === 'mdxTextExpression' ||
        node.type === 'mdxjsEsm'
      );
    }

    if (isMdxJsxNode(node)) {
      for (const attribute of node.attributes) {
        if (
          isMdxJsxAttribute(attribute) &&
          (attribute.name === 'id' || attribute.name === 'name') &&
          typeof attribute.value === 'string'
        ) {
          anchors.add(attribute.value);
        }
      }
    }

    if (node.type === 'link' || node.type === 'image') {
      links.push({
        kind: node.type,
        url: node.url,
        location: adjustLocation(node, bodyStartLine),
      });
      return;
    }

    function isMdxJsxNode(node: Node): node is MdxJsxNode {
      return (
        (node.type === 'mdxJsxFlowElement' ||
          node.type === 'mdxJsxTextElement') &&
        'attributes' in node &&
        Array.isArray(node.attributes)
      );
    }

    function isMdxJsxAttribute(value: unknown): value is MdxJsxAttribute {
      return (
        typeof value === 'object' &&
        value !== null &&
        'type' in value &&
        value.type === 'mdxJsxAttribute' &&
        'name' in value &&
        typeof value.name === 'string' &&
        'value' in value
      );
    }

    if (node.type === 'linkReference' || node.type === 'imageReference') {
      const resolvedUrl = definitions.get(normalizeIdentifier(node.identifier));
      if (resolvedUrl) {
        links.push({
          kind: node.type === 'linkReference' ? 'link' : 'image',
          url: resolvedUrl,
          location: adjustLocation(node, bodyStartLine),
        });
      }
    }
  });

  const factReferences: FactReference[] = [];
  for (const match of sourceText.matchAll(factPattern)) {
    const key = match[1];
    if (!key || match.index === undefined) {
      continue;
    }
    const startOffset = match.index;
    if (
      excludedFactRanges.some(
        (range) => startOffset >= range.start && startOffset < range.end,
      )
    ) {
      continue;
    }
    factReferences.push({
      key,
      raw: match[0],
      startOffset,
      endOffset: startOffset + match[0].length,
      location: offsetToLocation(sourceText, match.index, 1),
    });
  }

  return {
    headings,
    anchors,
    links,
    factReferences,
  };
}

function normalizeIdentifier(value: string): string {
  return value.trim().replace(/\s+/gu, ' ').toLowerCase();
}

function adjustLocation(node: Node, bodyStartLine: number): SourceLocation {
  const position = node.position;
  if (!position) {
    return { line: bodyStartLine, column: 1 };
  }

  return {
    line: position.start.line + bodyStartLine - 1,
    column: position.start.column,
    endLine: position.end.line + bodyStartLine - 1,
    endColumn: position.end.column,
  };
}

function offsetToLocation(
  source: string,
  offset: number,
  bodyStartLine: number,
): SourceLocation {
  const before = source.slice(0, offset);
  const lines = before.split(/\r?\n/u);
  return {
    line: bodyStartLine + lines.length - 1,
    column: (lines.at(-1)?.length ?? 0) + 1,
  };
}

function collectText(node: Parent): string {
  let result = '';
  for (const child of node.children) {
    if (
      child.type === 'text' ||
      child.type === 'inlineCode' ||
      child.type === 'code'
    ) {
      result += child.value;
      continue;
    }

    if (child.type === 'image' || child.type === 'imageReference') {
      result += child.alt ?? '';
      continue;
    }

    if ('children' in child) {
      result += collectText(child);
    }
  }
  return result.trim();
}
