# Content Contract Engine

[![CI](https://github.com/Jason-Doyle/ContentContractEngine/actions/workflows/ci.yml/badge.svg)](https://github.com/Jason-Doyle/ContentContractEngine/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/content-contract-engine)](https://www.npmjs.com/package/content-contract-engine)
[![Node.js](https://img.shields.io/node/v/content-contract-engine)](package.json)
[![License](https://img.shields.io/github/license/Jason-Doyle/ContentContractEngine)](LICENSE)

Content Contract Engine is a local-first TypeScript CLI and library for applying
deterministic release contracts to Markdown and MDX.

Version 0.1.0 is the first public preview. The package is tested on Node.js 22
and 24 across Windows and Ubuntu. Its configuration, findings, rule IDs, exit
codes, and published JSON schemas are documented compatibility surfaces.

## What it covers

| Contract        | Built-in behavior                                                         |
| --------------- | ------------------------------------------------------------------------- |
| Frontmatter     | Validate YAML frontmatter against JSON Schema 2020-12                     |
| Local links     | Check exact file casing, images, extensionless paths, and heading anchors |
| Canonical facts | Resolve explicit references from one reviewable YAML catalog              |
| Freshness       | Enforce review and expiry dates using UTC calendar days                   |
| Existing debt   | Baseline current findings while failing new regressions                   |
| Automation      | Return sorted terminal or versioned JSON findings with stable rule IDs    |
| Rendering       | Substitute facts into a separate output tree without editing source files |

The engine complements prose linters and external URL checkers. It does not
replace markdownlint, Vale, lychee, a static-site generator, or an HTML
sanitizer.

## Install

```powershell
npm install --save-dev content-contract-engine
```

Node.js 22 or newer is required. The package is ESM-only.

## Add it to an existing repository

Create a configuration for the files you already have:

```powershell
npx content-contract init . --source "docs/**/*.{md,mdx}"
npx content-contract verify
```

This mode creates:

- `content-contract.config.json`;
- an empty, reviewable `.content-contract-baseline.json`;
- `.content-contract/.gitignore` for generated output.

It does not create or edit files under your source glob.

If verification reports existing debt that cannot be fixed in the same change,
review the findings and capture that exact set:

```powershell
npx content-contract baseline
npx content-contract verify
```

The baseline matches rule ID, file, source location, and message. A new or
changed finding still fails the gate. Baselines affect `verify`; `render` always
blocks on the complete unsuppressed error set.

## Try a complete example

```powershell
npx content-contract init ./content-contract-demo
npx content-contract verify --config ./content-contract-demo/content-contract.config.json
npx content-contract render --config ./content-contract-demo/content-contract.config.json
```

The generated review dates are 180 days from initialization. They are intended
to expire and should be replaced with dates that match the repository's review
policy.

A successful verification ends with output like:

```text
PASS: 2 file(s), 1 fact(s), 0 error(s), 0 warning(s), 0 info message(s), 0 baselined finding(s).
```

## Configuration

```json
{
  "$schema": "https://raw.githubusercontent.com/Jason-Doyle/ContentContractEngine/v0.1.0/schemas/content-contract.config.schema.json",
  "version": 1,
  "sources": [
    {
      "id": "docs",
      "include": ["docs/**/*.{md,mdx}"],
      "frontmatterSchema": "docs/schema.json"
    }
  ],
  "baseline": {
    "file": ".content-contract-baseline.json"
  },
  "facts": {
    "file": "docs/facts.yaml"
  },
  "freshness": {
    "warningDays": 30
  },
  "render": {
    "outputDirectory": ".content-contract/rendered"
  },
  "gate": {
    "failOn": "error"
  }
}
```

Canonical facts remain ordinary reviewable files:

```yaml
version: 1
facts:
  api_version:
    value: v2
    owner: platform
    source: docs/architecture.md
    reviewBy: 2027-03-20
```

Content references facts explicitly:

```markdown
The current API version is {{fact:api_version}}.
```

`verify` checks that the reference exists. `render` substitutes the configured
value into the separate output tree. The optional fact `source` is descriptive
metadata; the engine does not fetch or independently verify it.

## Commands

| Command                                 | Behavior                                               |
| --------------------------------------- | ------------------------------------------------------ |
| `content-contract init [directory]`     | Create a complete example project                      |
| `content-contract init --source <glob>` | Configure an existing content tree                     |
| `content-contract verify`               | Run deterministic validators and the release gate      |
| `content-contract baseline`             | Replace the configured baseline with current findings  |
| `content-contract render`               | Verify without baseline suppression, then render facts |
| `content-contract explain <rule>`       | Explain a stable rule ID or name                       |

Exit code `0` means success, `1` means the release gate failed, and `2` means
the command or project could not be evaluated.

Both `verify` and `render` support `--format json`. See the
[CLI reference](docs/cli.md) and the
[verification result schema](schemas/verification-result.schema.json).

## GitHub Actions

Install the package in the repository and add:

```yaml
name: Content contract

on:
  pull_request:
  push:
    branches:
      - main

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx --no-install content-contract verify --format json
```

## Library API

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
        help: 'Add owner to the document frontmatter.',
      })),
};

const result = await verify('./content-contract.config.json', {
  validators: [validator],
});

if (!result.passed) {
  process.exitCode = 1;
}
```

The supported exports and schema subpaths are listed in the
[library API reference](docs/library.md).

## Design boundaries

1. Deterministic validators decide pass or fail.
2. The built-in engine does not use accounts, telemetry, hosted services, or
   model providers.
3. Rendering never overwrites source documents.
4. Configuration, facts, and baselines are reviewable files that can weaken a
   release gate and should receive the same review as code.
5. Findings are sorted and contain a stable rule ID, severity, help text, and a
   source location when one is meaningful.

## Documentation

- [Setup](docs/setup.md)
- [CLI reference](docs/cli.md)
- [Configuration](docs/configuration.md)
- [Contract behavior](docs/contracts.md)
- [Library API](docs/library.md)
- [Architecture](docs/architecture.md)
- [Validation rules](docs/rules.md)
- [Agent workflow](docs/agent-workflow.md)
- [Security model](docs/security-model.md)
- [Maintainer releases](docs/releasing.md)
- [Roadmap and scope](docs/roadmap.md)

## Current limitations

- External URLs are not fetched.
- Referenced assets are validated but not copied during rendering.
- Fact values are inserted verbatim; downstream rendering must escape them for
  its output context.
- Rendering is atomic per file, not across the complete output tree.
- Source-size limits are not enforced.
- macOS is intended to work but is not in the automated CI matrix.

## Development

```powershell
npm ci
npm run qa
```

See [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a change.

## License

Apache License 2.0.
