# Roadmap and Scope

## Current 0.1 implementation

- Markdown and MDX discovery
- JSON Schema frontmatter validation
- Internal path and heading validation
- Canonical fact references and safe rendering
- Review and expiry dates
- Stable terminal and JSON findings
- Library extension API

## Candidate follow-up work

- Baseline files that permit existing debt while blocking regressions
- HTML source support
- Fact source adapters that propose catalog updates without editing prose
- Cached external-link validation
- Static accessibility and metadata validators
- Framework adapters for Astro and other static-site generators
- MCP wrapper for agent-driven repair workflows

## Explicit non-goals

- Hosted content management
- User accounts or databases
- Model-generated pass/fail verdicts
- Executing arbitrary code blocks
- Editing source documents during rendering
- Replacing a full CMS or static-site generator

New features should preserve the local-first architecture and deterministic
release boundary.
