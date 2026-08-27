# Contributing

Thank you for improving Content Contract Engine.

## Setup

1. Install Node.js 22 or newer.
2. Run `npm ci`.
3. Run `npm run qa`.

## Changes

- Add or update tests for every behavior change.
- Preserve deterministic ordering.
- Give each new validation rule a permanent rule ID and documentation.
- Keep validators local-first and free of model-provider dependencies.
- Avoid network access in tests.

## Pull request readiness

A change is ready when formatting, linting, type checking, coverage, build,
example verification, and package inspection all pass through `npm run qa`. The
command also smoke-tests a clean package installation.

Repository: <https://github.com/Jason-Doyle/ContentContractEngine>
