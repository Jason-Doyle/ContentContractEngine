import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

import {
  Ajv2020,
  type AnySchema,
  type ErrorObject,
  type ValidateFunction,
} from 'ajv/dist/2020.js';
import type { FormatsPlugin } from 'ajv-formats';

import { ContentContractError, errorMessage } from './errors.js';

const require = createRequire(import.meta.url);
const loadedFormats: unknown = require('ajv-formats');
const formatsPlugin = resolveFormatsPlugin(loadedFormats);

export async function readJsonFile(filePath: string): Promise<unknown> {
  let text: string;
  try {
    text = await readFile(filePath, 'utf8');
  } catch (error) {
    throw new ContentContractError(
      'FILE_READ_FAILED',
      `Unable to read ${filePath}: ${errorMessage(error)}`,
      { cause: error },
    );
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new ContentContractError(
      'JSON_INVALID',
      `Invalid JSON in ${filePath}: ${errorMessage(error)}`,
      { cause: error },
    );
  }
}

export function compileSchema(
  schema: unknown,
  sourceDescription: string,
): ValidateFunction<unknown> {
  return compileWithAjv(createAjv(), schema, sourceDescription);
}

export function compileSchemaWithReferences(
  schema: unknown,
  sourceDescription: string,
  references: readonly {
    schema: unknown;
    sourceDescription: string;
  }[],
): ValidateFunction<unknown> {
  const ajv = createAjv();
  for (const reference of references) {
    if (!isSchema(reference.schema)) {
      throw new ContentContractError(
        'SCHEMA_INVALID',
        `JSON Schema in ${reference.sourceDescription} must be an object or boolean.`,
      );
    }
    ajv.addSchema(reference.schema);
  }
  return compileWithAjv(ajv, schema, sourceDescription);
}

function createAjv(): Ajv2020 {
  const ajv = new Ajv2020({
    allErrors: true,
    allowUnionTypes: true,
    strict: true,
  });
  formatsPlugin(ajv);
  return ajv;
}

function compileWithAjv(
  ajv: Ajv2020,
  schema: unknown,
  sourceDescription: string,
): ValidateFunction<unknown> {
  if (!isSchema(schema)) {
    throw new ContentContractError(
      'SCHEMA_INVALID',
      `JSON Schema in ${sourceDescription} must be an object or boolean.`,
    );
  }

  try {
    return ajv.compile(schema);
  } catch (error) {
    throw new ContentContractError(
      'SCHEMA_INVALID',
      `Invalid JSON Schema in ${sourceDescription}: ${errorMessage(error)}`,
      { cause: error },
    );
  }
}

function isSchema(value: unknown): value is AnySchema {
  return (
    typeof value === 'boolean' ||
    (typeof value === 'object' && value !== null && !Array.isArray(value))
  );
}

function resolveFormatsPlugin(value: unknown): FormatsPlugin {
  if (isFormatsPlugin(value)) {
    return value;
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'default' in value &&
    isFormatsPlugin(value.default)
  ) {
    return value.default;
  }
  throw new ContentContractError(
    'FORMAT_PLUGIN_INVALID',
    'Unable to load JSON Schema format validation.',
  );
}

function isFormatsPlugin(value: unknown): value is FormatsPlugin {
  return typeof value === 'function';
}

export function formatSchemaErrors(
  errors: readonly ErrorObject[] | null | undefined,
): string {
  if (!errors || errors.length === 0) {
    return 'Schema validation failed.';
  }

  return errors
    .map((error) => {
      const location = error.instancePath || '/';
      return `${location} ${error.message ?? 'is invalid'}`;
    })
    .join('; ');
}
