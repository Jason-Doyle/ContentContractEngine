import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { ContentContractError, render, verify } from '../src/index.js';
import {
  compileSchema,
  compileSchemaWithReferences,
  formatSchemaErrors,
  readJsonFile,
} from '../src/schema.js';
import {
  createTemporaryProject,
  createValidProject,
  writeProjectFile,
} from './helpers.js';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

describe('published schemas', () => {
  it('validates the example configuration and fact catalog', async () => {
    const configSchema = compileSchema(
      await readJsonFile(
        path.join(
          projectRoot,
          'schemas',
          'content-contract.config.schema.json',
        ),
      ),
      'config schema',
    );
    const factsSchema = compileSchema(
      await readJsonFile(
        path.join(projectRoot, 'schemas', 'facts.schema.json'),
      ),
      'facts schema',
    );
    const config = await readJsonFile(
      path.join(
        projectRoot,
        'examples',
        'basic',
        'content-contract.config.json',
      ),
    );
    const factsText = await import('node:fs/promises').then(({ readFile }) =>
      readFile(
        path.join(projectRoot, 'examples', 'basic', 'content', 'facts.yaml'),
        'utf8',
      ),
    );

    expect(configSchema(config), formatSchemaErrors(configSchema.errors)).toBe(
      true,
    );
    const facts = parse(factsText) as unknown;
    expect(factsSchema(facts), formatSchemaErrors(factsSchema.errors)).toBe(
      true,
    );
  });

  it('validates the CLI verification result contract', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(root);
    const result = await verify(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });
    const resultSchema = compileSchema(
      await readJsonFile(
        path.join(projectRoot, 'schemas', 'verification-result.schema.json'),
      ),
      'verification result schema',
    );

    expect(resultSchema(result), formatSchemaErrors(resultSchema.errors)).toBe(
      true,
    );
  });

  it('validates the render execution contract', async () => {
    const root = await createTemporaryProject();
    const configPath = await createValidProject(root);
    const execution = await render(configPath, {
      now: new Date('2026-08-27T00:00:00.000Z'),
    });
    const verificationSchema = await readJsonFile(
      path.join(projectRoot, 'schemas', 'verification-result.schema.json'),
    );
    const validate = compileSchemaWithReferences(
      await readJsonFile(
        path.join(projectRoot, 'schemas', 'render-execution.schema.json'),
      ),
      'render execution schema',
      [
        {
          schema: verificationSchema,
          sourceDescription: 'verification result schema',
        },
      ],
    );

    expect(validate(execution), formatSchemaErrors(validate.errors)).toBe(true);
  });

  it('surfaces malformed JSON and malformed schemas explicitly', async () => {
    const root = await createTemporaryProject();
    const invalidJson = path.join(root, 'invalid.json');
    await writeProjectFile(root, 'invalid.json', '{');

    await expect(readJsonFile(invalidJson)).rejects.toMatchObject({
      code: 'JSON_INVALID',
    });
    let schemaError: unknown;
    try {
      compileSchema('not-a-schema', 'inline');
    } catch (error) {
      schemaError = error;
    }
    expect(schemaError).toBeInstanceOf(ContentContractError);
    if (!(schemaError instanceof ContentContractError)) {
      throw new Error('Expected ContentContractError.');
    }
    expect(schemaError.code).toBe('SCHEMA_INVALID');
    expect(formatSchemaErrors(null)).toBe('Schema validation failed.');
  });
});
