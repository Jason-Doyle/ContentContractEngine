# Changelog

All notable changes will be documented in this file.

## Unreleased

## 0.1.0 - 2026-09-21

- Initial local-first content contract engine.
- JSON Schema frontmatter validation for Markdown and MDX sources.
- Exact-case internal link and GitHub-style heading validation.
- Canonical fact catalogs with separate-tree rendering.
- Review and expiry validation for documents and facts.
- Stable rule identifiers and versioned JSON verification output.
- Baseline files for accepting exact existing findings while blocking
  regressions.
- Existing-repository initialization through `init --source`.
- Extensible library validators and a documented agent repair loop.
- Rendering respects the configured or command-line failure threshold.
- Rendering always blocks errors and rejects a `never` command-line threshold.
- Complete CLI and security-model documentation.
- ESM library API and versioned JSON Schema package exports.
- npm package validation, external TypeScript consumer checks, and trusted
  publishing release automation.
- Generated examples use a six-month review date instead of a permanent
  placeholder.
- Repository documentation is validated by the engine itself.
- CLI positional arguments and fact-date failures use documented stable errors.
- TypeScript 7 native compiler with the TypeScript 6 compatibility API for
  ESLint tooling.
- GitHub Actions checkout 7.0.1 and setup-node 7.0.0.
