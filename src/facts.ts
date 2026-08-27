import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

import { parseDocument } from 'yaml';

import type { FactsCatalog, FactsFile } from './types.js';
import type { ResolvedProjectConfig } from './types.js';
import { ContentContractError, errorMessage } from './errors.js';
import { compileSchema, formatSchemaErrors, readJsonFile } from './schema.js';
import { assertExistingPathInside, relativeProjectPath } from './paths.js';

const bundledFactsSchemaPath = fileURLToPath(
  new URL('../schemas/facts.schema.json', import.meta.url),
);

export async function loadFacts(
  config: ResolvedProjectConfig,
): Promise<FactsCatalog> {
  if (!config.factsFilePath) {
    return {
      configured: false,
      filePath: null,
      relativePath: null,
      facts: Object.freeze({}),
    };
  }

  await assertExistingPathInside(
    config.rootDirectory,
    config.factsFilePath,
    'Facts file',
  );

  let source: string;
  try {
    source = await readFile(config.factsFilePath, 'utf8');
  } catch (error) {
    throw new ContentContractError(
      'FACTS_READ_FAILED',
      `Unable to read facts file ${config.factsFilePath}: ${errorMessage(error)}`,
      { cause: error },
    );
  }

  const document = parseDocument(source, { prettyErrors: false });
  if (document.errors.length > 0) {
    throw new ContentContractError(
      'FACTS_YAML_INVALID',
      `Invalid YAML in ${config.factsFilePath}: ${document.errors.map((error) => error.message).join('; ')}`,
    );
  }

  const rawFacts = document.toJS() as unknown;
  const factsSchema = await readJsonFile(bundledFactsSchemaPath);
  const validateFacts = compileSchema(factsSchema, bundledFactsSchemaPath);
  if (!validateFacts(rawFacts)) {
    throw new ContentContractError(
      'FACTS_INVALID',
      `Invalid facts file ${config.factsFilePath}: ${formatSchemaErrors(validateFacts.errors)}`,
    );
  }

  const factsFile = rawFacts as FactsFile;
  return {
    configured: true,
    filePath: config.factsFilePath,
    relativePath: relativeProjectPath(
      config.rootDirectory,
      config.factsFilePath,
    ),
    facts: Object.freeze({ ...factsFile.facts }),
  };
}

export function renderFact(fact: FactsCatalog['facts'][string]): string {
  return fact.render ?? String(fact.value);
}
