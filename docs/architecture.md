# Architecture

Content Contract Engine separates deterministic validation from optional
agent-assisted repair.

```text
configuration
     |
     v
file discovery -> parsing -> project index -> validators -> findings
                                      |
                                      +-> renderer -> separate output tree
```

## Core concepts

### Project

A project is loaded relative to one configuration file. All source globs,
schemas, fact files, links, and output paths resolve from that configuration
directory.

### Document

A document snapshot contains its source path, parsed frontmatter, derived
headings, links, fact references, and source text. The Markdown syntax tree is
used during parsing but is not part of the public document model.

### Validator

A validator receives a read-only TypeScript project model and returns findings.
The model is not deep-frozen at runtime. Built-in validators do not modify
files, call external services, or depend on execution order. Library consumers
can provide trusted custom validators through `VerificationOptions.validators`;
the engine cannot enforce those constraints on third-party code.

### Finding

A finding has a stable rule ID, severity, file path, optional source location,
message, and remediation guidance. Findings are sorted before presentation.

### Renderer

The renderer resolves explicit canonical fact references into a separate output
directory. It never edits source documents, refuses paths outside the project,
and blocks writes through symbolic links.

## Determinism

- Sources are sorted after discovery.
- Validators return data rather than writing output directly.
- Findings are sorted by file, location, severity, rule ID, and message.
- Built-in JSON reports contain no generated identifiers or timestamps.
- The current date can be injected through the library or `--now`.

## Trust boundaries

- Project configuration, schemas, and facts must resolve inside the project.
- Symlinks cannot be used to read schemas or content outside the project.
- Render paths cannot traverse symlinks or leave the configured output tree.
- External links are not fetched in the initial release.
- Markdown and MDX are parsed but never executed.
- Fact values are rendered only when the source explicitly references them.

Custom validators execute as trusted application code and may perform operations
outside these built-in boundaries.

## Failure model

- Exit code `0`: verification passed.
- Exit code `1`: findings met the configured failure threshold.
- Exit code `2`: configuration, parsing, or execution failed.

Malformed input is surfaced as a diagnostic or explicit execution error. It is
never silently ignored.
