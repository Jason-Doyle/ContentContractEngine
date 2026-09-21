# CLI Reference

The installed executable is `content-contract`. During development, use
`node dist/bin.js` after `npm run build`.

## Global options

| Option            | Behavior                  |
| ----------------- | ------------------------- |
| `--help`, `-h`    | Print command help        |
| `--version`, `-v` | Print the package version |

## `init`

```text
content-contract init [directory] [--source glob] [--force]
                      [--format pretty|json]
```

Creates configuration, a fact catalog, a frontmatter schema, and two linked
documents. Generated review dates are 180 days from the current UTC date.

`--source` configures an existing Markdown or MDX tree instead. It creates the
configuration, an empty baseline, and an ignored render directory without
creating or changing source documents. The glob must use `/` separators.

Existing generated paths are not overwritten unless `--force` is present. Even
with `--force`, writes through symbolic links are rejected.

## `verify`

```text
content-contract verify [-c path]
                        [--fail-on error|warning|never]
                        [--now YYYY-MM-DD]
                        [--format pretty|json]
```

The default configuration path is `content-contract.config.json` in the current
directory. `--fail-on` overrides `gate.failOn`. `--now` evaluates freshness
against a supplied UTC calendar date and is useful for deterministic tests.

When `baseline.file` is configured, exact matching findings are omitted from the
active finding list and reported through `counts.baselined`. New or changed
findings still affect the release gate.

## `baseline`

```text
content-contract baseline [-c path]
                          [--now YYYY-MM-DD]
                          [--format pretty|json]
```

Runs the deterministic validators without applying the existing baseline, then
replaces the configured baseline file with the current sorted findings. The
command fails if `baseline.file` is not configured.

Review baseline changes like code. A baseline can permit known debt, but it can
also weaken the verification gate.

## `render`

```text
content-contract render [-c path]
                        [--fail-on error|warning]
                        [--now YYYY-MM-DD]
                        [--format pretty|json]
```

Runs the same validation rules before writing. Errors always block rendering;
`--fail-on warning` additionally blocks warnings. A project configured with
`gate.failOn: never` therefore still uses an error floor for rendering.

Rendering does not apply baseline suppression. A known error may be accepted by
`verify`, but it cannot produce rendered output.

A failed render gate writes no new managed documents. Successful rendering
replaces explicit fact references in configured Markdown and MDX documents,
writes them beneath the output directory, and removes files owned by the
previous render manifest that are no longer present.

Assets are not copied.

## `explain`

```text
content-contract explain <rule-id|rule-name> [--format pretty|json]
```

Returns the authoritative description and remediation guidance for a built-in
rule.

## Exit codes

| Code | Meaning                                                              |
| ---- | -------------------------------------------------------------------- |
| `0`  | Command succeeded or the selected gate passed                        |
| `1`  | Verification findings met the selected failure threshold             |
| `2`  | Arguments, configuration, parsing, or execution prevented evaluation |

For `verify`, `--fail-on never` can return exit code `0` while the JSON result
still contains errors and warnings. Consumers should inspect `counts` when using
that mode. `render` does not accept that override.
