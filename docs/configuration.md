# Configuration

The project configuration is a JSON file named `content-contract.config.json`. A
JSON Schema is included under `schemas/`.

The initial structure is:

```json
{
  "version": 1,
  "sources": [
    {
      "id": "docs",
      "include": ["content/**/*.{md,mdx}"],
      "exclude": ["content/generated/**"],
      "frontmatterSchema": "content/schemas/docs.schema.json",
      "allowEmpty": false
    }
  ],
  "facts": {
    "file": "content/facts.yaml"
  },
  "freshness": {
    "warningDays": 30,
    "reviewByField": "reviewBy",
    "expiresField": "expires"
  },
  "render": {
    "outputDirectory": "rendered"
  },
  "gate": {
    "failOn": "error"
  }
}
```

Canonical facts use explicit references such as `{{fact:api_version}}`. Explicit
references avoid using an AI classifier as the release gate.

Sources fail when they match no files unless `allowEmpty` is explicitly true.
This prevents misspelled globs from producing a false successful release.

The engine always ignores `.git`, `node_modules`, and the configured render
output directory. Other directories, including `dist` and `coverage`, are
included when they match a source pattern unless explicitly excluded.

The complete machine-readable contracts are the
[configuration schema](../schemas/content-contract.config.schema.json) and
[fact schema](../schemas/facts.schema.json). Behavior and interactions between
settings are described in [contracts.md](contracts.md).

## Defaults

| Setting                   | Default                                                 |
| ------------------------- | ------------------------------------------------------- |
| Configuration path        | `content-contract.config.json` in the current directory |
| `source.exclude`          | Empty                                                   |
| `source.allowEmpty`       | `false`                                                 |
| `freshness.warningDays`   | `30`                                                    |
| `freshness.reviewByField` | `reviewBy`                                              |
| `freshness.expiresField`  | `expires`                                               |
| `render.outputDirectory`  | `.content-contract/rendered`                            |
| `gate.failOn`             | `error`                                                 |

`facts`, `freshness`, `render`, and `gate` are optional configuration sections.

## Path and source behavior

- Source IDs must be unique lowercase identifiers.
- A document may match only one source.
- Included files must be Markdown or MDX.
- Schema, fact, and output paths must remain inside the configuration directory.
- Root-relative content links resolve from the configuration directory, not a
  website routing base.
