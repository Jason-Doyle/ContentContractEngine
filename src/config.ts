import { fileURLToPath } from 'node:url';
import path from 'node:path';

import type {
  ProjectConfig,
  ResolvedProjectConfig,
  ResolvedSource,
} from './types.js';
import { ContentContractError } from './errors.js';
import { compileSchema, formatSchemaErrors, readJsonFile } from './schema.js';
import { assertExistingPathInside, resolveInside } from './paths.js';

const bundledConfigSchemaPath = fileURLToPath(
  new URL('../schemas/content-contract.config.schema.json', import.meta.url),
);

export async function loadProjectConfig(
  requestedPath = 'content-contract.config.json',
): Promise<ResolvedProjectConfig> {
  const configPath = path.resolve(requestedPath);
  const rootDirectory = path.dirname(configPath);
  const rawConfig = await readJsonFile(configPath);
  const configSchema = await readJsonFile(bundledConfigSchemaPath);
  const validateConfig = compileSchema(configSchema, bundledConfigSchemaPath);

  if (!validateConfig(rawConfig)) {
    throw new ContentContractError(
      'CONFIG_INVALID',
      `Invalid configuration in ${configPath}: ${formatSchemaErrors(validateConfig.errors)}`,
    );
  }

  const config = rawConfig as ProjectConfig;
  const sourceIds = new Set<string>();
  const sources: ResolvedSource[] = [];

  for (const source of config.sources) {
    if (sourceIds.has(source.id)) {
      throw new ContentContractError(
        'SOURCE_ID_DUPLICATE',
        `Source ID "${source.id}" is declared more than once.`,
      );
    }
    sourceIds.add(source.id);

    let frontmatterSchemaPath: string | null = null;
    let validateFrontmatter: ResolvedSource['validateFrontmatter'] = null;
    if (source.frontmatterSchema) {
      frontmatterSchemaPath = resolveInside(
        rootDirectory,
        source.frontmatterSchema,
        `Frontmatter schema for source "${source.id}"`,
      );
      await assertExistingPathInside(
        rootDirectory,
        frontmatterSchemaPath,
        `Frontmatter schema for source "${source.id}"`,
      );
      const schema = await readJsonFile(frontmatterSchemaPath);
      validateFrontmatter = compileSchema(schema, frontmatterSchemaPath);
    }

    sources.push({
      id: source.id,
      include: [...source.include],
      exclude: [...(source.exclude ?? [])],
      frontmatterSchemaPath,
      validateFrontmatter,
      allowEmpty: source.allowEmpty ?? false,
    });
  }

  const factsFilePath = config.facts
    ? resolveInside(rootDirectory, config.facts.file, 'Facts file')
    : null;

  const outputDirectory = resolveInside(
    rootDirectory,
    config.render?.outputDirectory ?? '.content-contract/rendered',
    'Render output directory',
  );
  if (outputDirectory === rootDirectory) {
    throw new ContentContractError(
      'OUTPUT_DIRECTORY_UNSAFE',
      'Render output directory cannot be the project root.',
    );
  }

  return {
    rootDirectory,
    configPath,
    sources,
    factsFilePath,
    freshness: {
      warningDays: config.freshness?.warningDays ?? 30,
      reviewByField: config.freshness?.reviewByField ?? 'reviewBy',
      expiresField: config.freshness?.expiresField ?? 'expires',
    },
    render: {
      outputDirectory,
    },
    gate: {
      failOn: config.gate?.failOn ?? 'error',
    },
  };
}
