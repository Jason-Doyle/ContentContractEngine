# Contributing

Thank you for improving Content Contract Engine.

## Setup

1. Install Node.js 22 or newer.
2. Run `npm ci`.
3. Run `npm run qa`.

The repository uses npm 11. The lockfile is the source of truth for dependency
installation.

## Changes

- Add or update tests for every behavior change.
- Add malformed-input and failure-path coverage, not only successful cases.
- Preserve deterministic ordering.
- Give each new validation rule a permanent rule ID and documentation.
- Keep validators local-first and free of model-provider dependencies.
- Avoid network access in tests.
- Do not mutate source documents during verification or rendering.

## Public compatibility

Changes to exported TypeScript types, configuration version 1, published JSON
schemas, rule IDs, CLI commands, JSON output, or exit codes require matching
documentation and a changelog entry.

The supported package exports are documented in
[docs/library.md](docs/library.md). Internal modules are not compatibility
surfaces.

## Pull request readiness

A change is ready when formatting, linting, type checking, coverage, build,
example verification, and package inspection all pass through `npm run qa`. The
command also smoke-tests a clean package installation.

Repository: <https://github.com/Jason-Doyle/ContentContractEngine>
