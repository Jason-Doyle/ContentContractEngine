import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export async function createTemporaryProject(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'content-contract-'));
}

export async function writeProjectFile(
  root: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const filePath = path.join(root, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}

export function baseConfig(overrides: Record<string, unknown> = {}): string {
  return `${JSON.stringify(
    {
      version: 1,
      sources: [
        {
          id: 'docs',
          include: ['content/**/*.{md,mdx}'],
          frontmatterSchema: 'content/schema.json',
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
        outputDirectory: 'rendered',
      },
      gate: {
        failOn: 'error',
      },
      ...overrides,
    },
    null,
    2,
  )}\n`;
}

export const frontmatterSchema = `${JSON.stringify(
  {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    additionalProperties: false,
    required: ['title'],
    properties: {
      title: {
        type: 'string',
        minLength: 1,
      },
      reviewBy: {
        type: 'string',
      },
      expires: {
        type: 'string',
      },
    },
  },
  null,
  2,
)}\n`;

export const validFacts = [
  'version: 1',
  'facts:',
  '  api_version:',
  '    value: v2',
  '    owner: platform',
  '    reviewBy: 2099-01-01',
  '',
].join('\n');

export async function createValidProject(
  root: string,
  document = [
    '---',
    'title: Home',
    'reviewBy: 2099-01-01',
    '---',
    '',
    '# Home',
    '',
    'API version: {{fact:api_version}}.',
    '',
  ].join('\n'),
): Promise<string> {
  await writeProjectFile(root, 'content-contract.config.json', baseConfig());
  await writeProjectFile(root, 'content/schema.json', frontmatterSchema);
  await writeProjectFile(root, 'content/facts.yaml', validFacts);
  await writeProjectFile(root, 'content/index.md', document);
  return path.join(root, 'content-contract.config.json');
}
