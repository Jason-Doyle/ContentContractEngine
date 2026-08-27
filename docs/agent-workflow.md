# Agent Workflow

Content Contract Engine treats an agent as a repair author, not as the release
authority.

## Recommended loop

1. Run `content-contract verify --format json`.
2. Give the findings to an agent.
3. Let the agent propose source, schema, fact, or link changes.
4. Review the resulting file diff.
5. Run the same deterministic verification command.
6. Publish only the exact version that passed.

The current release does not cryptographically bind a result to a Git commit or
artifact digest. The publishing workflow is responsible for ensuring the files
being published are the files that were verified.

## Why JSON findings matter

Each finding carries a stable rule ID, file, source location, message, and help
text. Agents do not need to scrape terminal prose or infer which rule failed.

## Guardrails

- Do not let an agent suppress a rule without human review.
- Review changes to configuration, source globs, schemas, and `failOn`; an agent
  can otherwise weaken what is being checked.
- Do not let an agent replace canonical facts with guessed values.
- Keep fact sources and owners in the fact catalog.
- Keep model calls outside the validator process.
- Treat a clean verifier result as necessary, not sufficient, for publication.

Future integrations may expose verification through MCP, but the underlying
engine will remain deterministic and usable without an agent.
