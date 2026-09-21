# Library API

Content Contract Engine publishes an ESM-only TypeScript API.

## Functions

### `verify(configPath?, options?)`

Loads a project, runs built-in and supplied validators, applies the configured
baseline, sorts active findings, and returns a `VerificationResult`.

### `render(configPath?, options?)`

Runs verification without baseline suppression. When the render gate passes, it
writes fact substitutions beneath the configured output directory.

### `createBaseline(configPath?, options?)`

Runs validators without applying the existing baseline and replaces the
configured baseline file with the current findings.

### `initializeProject(directory?, options?)`

Creates either a complete example project or an existing-repository
configuration when `options.source` is supplied. `options.now` supports
deterministic initialization in tests and tools.

### `findRule(identifier)` and `rules`

Return the documented built-in rule definitions.

## Errors

Expected configuration and execution failures throw `ContentContractError`. The
`code` property is stable for a given failure class. Human-readable wording may
become clearer in compatible releases.

## Custom validators

```typescript
import { verify, type ContentValidator } from 'content-contract-engine';

const validator: ContentValidator = {
  name: 'required-owner',
  validate: ({ project }) =>
    project.documents
      .filter((document) => !document.frontmatter.owner)
      .map((document) => ({
        ruleId: 'ORG001',
        ruleName: 'required-owner',
        severity: 'error',
        file: document.relativePath,
        message: 'Content must have an owner.',
        help: 'Add owner to document frontmatter.',
      })),
};

const result = await verify('./content-contract.config.json', {
  validators: [validator],
});
```

Custom validators are trusted application code. They can perform arbitrary I/O,
so the built-in no-network and no-mutation guarantees do not apply to them.

Use a rule namespace that cannot collide with `CCE`, such as `ORG001`.

## Exported types

The package root exports the types needed to configure projects, inspect
results, initialize projects, and write validators:

- baseline file, entry, and result types;
- content document, project, fact, heading, and link types;
- configuration and initialization types;
- finding, severity, source location, and rule types;
- verification and rendering option and result types;
- validator context and interface types.

Project loading, raw rendering, sorting helpers, resolved configuration
internals, and rule lookup maps are not public exports.

## JSON Schema subpaths

The package exports:

```text
content-contract-engine/schemas/baseline.schema.json
content-contract-engine/schemas/content-contract.config.schema.json
content-contract-engine/schemas/facts.schema.json
content-contract-engine/schemas/render-execution.schema.json
content-contract-engine/schemas/verification-result.schema.json
```

Their `$id` values point to immutable release tags.

## Compatibility

Breaking changes to exported types, configuration version 1, rule IDs, JSON
result schema version 1, or CLI exit codes require release notes. The package is
pre-1.0, so consumers should still pin a compatible minor version.
