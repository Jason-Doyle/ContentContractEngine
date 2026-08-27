# Contract Reference

## Configuration

Configuration is validated before file discovery. Unknown properties are
rejected so misspellings cannot silently disable validation.

A source that matches no files fails unless it explicitly sets
`allowEmpty: true`.

## Frontmatter

Each content source may reference a JSON Schema. Document frontmatter is
validated using that schema. Frontmatter is optional unless the schema requires
specific properties.

## Facts

Facts are stored in YAML:

```yaml
version: 1
facts:
  api_version:
    value: v1
    owner: platform
    source: docs/architecture.md
    reviewBy: 2099-01-01
```

Documents reference facts explicitly:

```text
The current API version is {{fact:api_version}}.
```

`verify` checks that every reference resolves. `render` substitutes the
configured value into a separate output tree.

Fact keys begin with a lowercase letter and may contain lowercase letters,
numbers, `_`, `.`, and `-`. Values may be strings, numbers, or booleans. An
optional `render` string controls the exact emitted text.

`owner` and `source` are descriptive metadata. The current implementation does
not contact the owner, read the source, or confirm that the value remains
correct.

References inside fenced code blocks or inline code are examples and are not
validated or replaced.

Frontmatter is validated before fact substitution. If a frontmatter JSON Schema
requires a concrete format, such as `date`, a fact token does not temporarily
satisfy that format. Use fact references in prose or permit the token form in
the source schema.

## Freshness

Documents and facts may declare:

- `reviewBy`: content should be reviewed on or before this date;
- `expires`: content must not be published on or after this date.

The current date is injected into the validator so tests remain deterministic.

- `expires` fails on the declared date and every day after it.
- `reviewBy` becomes an error on the following day.
- `reviewBy` produces a warning within `warningDays`, including on the date
  itself.
- Dates use strict `YYYY-MM-DD` calendar values.

## Links

The link validator resolves relative Markdown and MDX links and verifies heading
fragments using GitHub-compatible slugs.

Path casing is checked exactly, even on case-insensitive operating systems.
External protocols such as `https:` and `mailto:` are intentionally ignored in
the initial release.

The validator also:

- rejects Windows `\` separators in Markdown URLs;
- ignores query strings while resolving local targets;
- resolves extensionless links to Markdown, MDX, and directory index files;
- rejects links into generated render output;
- validates image and other local asset paths without copying those assets;
- parses linked Markdown or MDX outside the configured source set when a heading
  fragment must be checked.

## Findings

Every finding includes:

- stable `ruleId` and `ruleName`;
- `error`, `warning`, or `info` severity;
- project-relative file path;
- source location when one exists;
- concise message and remediation guidance.

The JSON result contract is versioned independently of the package under
`schemas/verification-result.schema.json`.

`render --format json` uses `schemas/render-execution.schema.json`. Managed
renders also write a manifest inside the output directory so documents removed
from the source set are removed safely on the next render. Files that predate
the first managed render are not deleted.

The render schema references `verification-result.schema.json`. JSON Schema
consumers should load both schemas so the verification schema `$id` can resolve
locally.

Freshness comparisons use UTC calendar days. This keeps CI behavior stable
across machines and time zones.

Rendering is atomic per file, not across the complete output tree. The manifest
is updated only after managed documents have been written.

Rendering always blocks errors, even when `gate.failOn` is `never`.
`gate.failOn: warning` also blocks warnings.

## Custom validators

Custom validators are available through the TypeScript library API, not through
the JSON configuration or CLI plugin discovery. Their findings are merged with
built-in findings and sorted deterministically.
