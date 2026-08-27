# Content Contract Engine

Content Contract Engine is a local-first TypeScript library and CLI for treating
Markdown and MDX as production assets with deterministic release contracts.

> **Author's disclaimer:** This project was extracted from functionality
> originally developed for a private personal project. Some documentation was
> generated with AI assistance and may contain mistakes. Verify behavior against
> the source code, schemas, and tests, and report any discrepancies.

It addresses a common docs-as-code failure mode: shape validation, link
checking, canonical values, and freshness checks are usually split across
unrelated tools with different configurations and exit behavior. This project
provides one project model, one finding format, and one release verdict.

The initial release provides four deterministic checks:

- frontmatter matches a declared JSON Schema;
- internal files and heading anchors resolve;
- canonical facts exist and render from one source of truth;
- declared review and expiry dates do not silently pass.

Agents may propose changes, but the built-in engine does not accept an
agent-supplied verdict. Built-in release findings come from deterministic rules
with stable identifiers. Configuration changes still require review because they
control what is checked.

## Quick start

The package has not been published. Run it from this working directory:

```powershell
npm ci
npm run build
node dist/bin.js init .\demo
node dist/bin.js verify --config .\demo\content-contract.config.json
node dist/bin.js render --config .\demo\content-contract.config.json
```

Rendering writes to the configured output directory and never changes source
documents.

## Example contract

```json
{
  "version": 1,
  "sources": [
    {
      "id": "docs",
      "include": ["content/**/*.{md,mdx}"],
      "frontmatterSchema": "content/schemas/docs.schema.json"
    }
  ],
  "facts": {
    "file": "content/facts.yaml"
  },
  "freshness": {
    "warningDays": 30
  },
  "render": {
    "outputDirectory": ".content-contract/rendered"
  }
}
```

Canonical facts remain reviewable files:

```yaml
version: 1
facts:
  api_version:
    value: v2
    owner: platform
    source: docs/architecture.md
    reviewBy: 2099-01-01
```

Content references facts explicitly:

```markdown
The current API version is {{fact:api_version}}.
```

`verify` checks that the reference exists. It does not fetch or independently
validate the optional `source` metadata. `render` resolves the configured value
into a separate content-only tree.

## Commands

| Command                             | Behavior                            |
| ----------------------------------- | ----------------------------------- |
| `content-contract init [directory]` | Create a minimal working project    |
| `content-contract verify`           | Run all deterministic validators    |
| `content-contract render`           | Verify, then render canonical facts |
| `content-contract explain <rule>`   | Explain a stable rule ID or name    |

Exit code `0` means success, `1` means a release gate failed, and `2` means the
command or project could not be evaluated.

Both `verify` and `render` support `--format json`. The verification output is
described by
[`schemas/verification-result.schema.json`](schemas/verification-result.schema.json);
the render envelope is described by
[`schemas/render-execution.schema.json`](schemas/render-execution.schema.json).

## Library API

```typescript
import { verify, type ContentValidator } from 'content-contract-engine';

const result = await verify('./content-contract.config.json', {
  now: new Date('2026-08-27T00:00:00Z'),
});

if (!result.passed) {
  process.exitCode = 1;
}
```

Library users may add deterministic validators without changing the CLI core:

```typescript
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
        help: 'Add owner to the document frontmatter.',
      })),
};

const result = await verify('./content-contract.config.json', {
  validators: [validator],
});
```

## Principles

1. Local-first: no account, hosted service, or telemetry.
2. Deterministic: identical inputs produce identically ordered findings.
3. Reviewable: configuration and facts are files; findings and rendered output
   are deterministic and serializable.
4. Safe by default: source files are never overwritten by rendering.
5. Extensible: validators use a small public interface and stable result model.

## AI and agent workflow

Agents consume JSON findings, propose edits, and run verification again. They
cannot mark a failing document as passing. See
[Agent workflow](docs/agent-workflow.md).

## Development

```powershell
npm ci
npm run qa
```

Node.js 22 or newer is required. Complete setup instructions are in
[docs/setup.md](docs/setup.md).

## Documentation

- [Setup](docs/setup.md)
- [CLI reference](docs/cli.md)
- [Architecture](docs/architecture.md)
- [Configuration and facts](docs/configuration.md)
- [Contract reference](docs/contracts.md)
- [Validation rules](docs/rules.md)
- [Agent workflow](docs/agent-workflow.md)
- [Security model](docs/security-model.md)
- [Roadmap and scope](docs/roadmap.md)

## Current scope

- Markdown and MDX source files
- YAML frontmatter
- JSON Schema 2020-12 frontmatter contracts
- Relative file, image, and heading links
- GitHub-compatible heading slugs
- Explicit canonical fact references
- Review and expiry dates

The initial release deliberately does not execute document code, crawl external
URLs, call models, mutate source files, or provide a hosted service.

Rendering copies only configured Markdown and MDX documents. Referenced images
and other assets are validated for existence but are not copied; downstream site
tooling remains responsible for assets and final HTML rendering.

## License

Apache License 2.0.
