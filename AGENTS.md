# Agent Contribution Instructions

## Scope

This project is a local-first content validation engine. Do not add hosted
services, telemetry, accounts, databases, or model-provider dependencies.

## Required checks

Before completing a code change, run:

```powershell
npm run qa
```

Use the smallest targeted Vitest invocation while iterating, then run the full
quality command before handoff.

## Design rules

- Deterministic validators decide pass or fail. AI may only propose fixes.
- Keep source files immutable; rendered output must use a separate directory.
- Findings require a stable rule ID, severity, help text, and a source location
  when one is meaningful.
- Sort discovered files and findings before returning or serializing them.
- Reject unsafe output paths instead of silently normalizing them.
- Never include secret values in diagnostics.
- Prefer pure validator functions and dependency injection for clocks and I/O.
- Add tests for malformed input and failure paths, not only successful cases.

## Public API

Breaking changes to exported TypeScript types, configuration, rule IDs, or CLI
exit codes require documentation and a changelog entry.
