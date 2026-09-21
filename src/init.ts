import { lstat, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { InitOptions, InitResult } from './types.js';
import { ContentContractError, errorMessage } from './errors.js';
import { relativeProjectPath } from './paths.js';
import { assertNoSymlinkSegments } from './paths.js';
import { publishedSchemaUrl } from './schema-urls.js';

interface TemplateFile {
  path: string;
  content: string;
}

export async function initializeProject(
  requestedDirectory = '.',
  options: InitOptions = {},
): Promise<InitResult> {
  const directory = path.resolve(requestedDirectory);
  const templates = buildTemplates(options);
  await mkdir(directory, { recursive: true });

  if (!options.force) {
    const collisions: string[] = [];
    for (const template of templates) {
      const filePath = path.join(directory, template.path);
      try {
        await lstat(filePath);
        collisions.push(template.path);
      } catch (error) {
        if (!isMissingFile(error)) {
          throw error;
        }
      }
    }

    if (collisions.length > 0) {
      throw new ContentContractError(
        'INIT_FILES_EXIST',
        `Refusing to overwrite existing files: ${collisions.join(', ')}. Use --force to replace only the generated files.`,
      );
    }
  }

  for (const template of templates) {
    const filePath = path.join(directory, template.path);
    await assertNoSymlinkSegments(
      directory,
      filePath,
      `Initialized path ${template.path}`,
    );
    await mkdir(path.dirname(filePath), { recursive: true });
    try {
      await writeFile(filePath, template.content, 'utf8');
    } catch (error) {
      throw new ContentContractError(
        'INIT_WRITE_FAILED',
        `Unable to write ${filePath}: ${errorMessage(error)}`,
        { cause: error },
      );
    }
  }

  return {
    directory,
    files: templates
      .map((template) =>
        relativeProjectPath(directory, path.join(directory, template.path)),
      )
      .sort((left, right) => left.localeCompare(right, 'en')),
  };
}

function buildTemplates(options: InitOptions): readonly TemplateFile[] {
  const source = options.source?.trim();
  if (options.source !== undefined && (!source || source.includes('\\'))) {
    throw new ContentContractError(
      'INIT_SOURCE_INVALID',
      'The source glob must be non-empty and use forward slashes.',
    );
  }

  if (source) {
    return buildExistingProjectTemplates(source);
  }

  const reviewBy = reviewDate(options.now ?? new Date(), 180);
  return buildExampleTemplates(reviewBy);
}

function buildExistingProjectTemplates(
  source: string,
): readonly TemplateFile[] {
  return [
    {
      path: 'content-contract.config.json',
      content: `${JSON.stringify(
        {
          $schema: publishedSchemaUrl('content-contract.config.schema.json'),
          version: 1,
          sources: [
            {
              id: 'docs',
              include: [source],
            },
          ],
          baseline: {
            file: '.content-contract-baseline.json',
          },
          render: {
            outputDirectory: '.content-contract/rendered',
          },
          gate: {
            failOn: 'error',
          },
        },
        null,
        2,
      )}\n`,
    },
    {
      path: '.content-contract-baseline.json',
      content: `${JSON.stringify(
        {
          $schema: publishedSchemaUrl('baseline.schema.json'),
          version: 1,
          findings: [],
        },
        null,
        2,
      )}\n`,
    },
    {
      path: '.content-contract/.gitignore',
      content: ['*', '!.gitignore', ''].join('\n'),
    },
  ];
}

function buildExampleTemplates(reviewBy: string): readonly TemplateFile[] {
  return [
    {
      path: 'content-contract.config.json',
      content: `${JSON.stringify(
        {
          $schema: publishedSchemaUrl('content-contract.config.schema.json'),
          version: 1,
          sources: [
            {
              id: 'docs',
              include: ['content/**/*.{md,mdx}'],
              frontmatterSchema: 'content/schemas/docs.schema.json',
            },
          ],
          facts: {
            file: 'content/facts.yaml',
          },
          freshness: {
            warningDays: 30,
            reviewByField: 'reviewBy',
            expiresField: 'expires',
          },
          render: {
            outputDirectory: '.content-contract/rendered',
          },
          gate: {
            failOn: 'error',
          },
        },
        null,
        2,
      )}\n`,
    },
    {
      path: 'content/facts.yaml',
      content: [
        `$schema: ${publishedSchemaUrl('facts.schema.json')}`,
        'version: 1',
        'facts:',
        '  contract_version:',
        '    value: v1',
        '    owner: maintainers',
        '    source: content-contract.config.json',
        `    reviewBy: ${reviewBy}`,
        '',
      ].join('\n'),
    },
    {
      path: 'content/schemas/docs.schema.json',
      content: `${JSON.stringify(
        {
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          type: 'object',
          additionalProperties: true,
          required: ['title', 'reviewBy'],
          properties: {
            title: {
              type: 'string',
              minLength: 1,
            },
            reviewBy: {
              type: 'string',
              format: 'date',
            },
            expires: {
              type: 'string',
              format: 'date',
            },
          },
        },
        null,
        2,
      )}\n`,
    },
    {
      path: 'content/index.md',
      content: [
        '---',
        'title: Getting started',
        `reviewBy: ${reviewBy}`,
        '---',
        '',
        '# Getting started',
        '',
        'This content uses contract version {{fact:contract_version}}.',
        '',
        'Read the [architecture](architecture.md#architecture) next.',
        '',
      ].join('\n'),
    },
    {
      path: 'content/architecture.md',
      content: [
        '---',
        'title: Architecture',
        `reviewBy: ${reviewBy}`,
        '---',
        '',
        '# Architecture',
        '',
        'Source content is verified before it is rendered.',
        '',
      ].join('\n'),
    },
    {
      path: '.content-contract/.gitignore',
      content: ['*', '!.gitignore', ''].join('\n'),
    },
  ];
}

function reviewDate(now: Date, days: number): string {
  if (Number.isNaN(now.getTime())) {
    throw new ContentContractError(
      'INIT_DATE_INVALID',
      'Initialization requires a valid current date.',
    );
  }
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
