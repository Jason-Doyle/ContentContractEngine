# Validation Rules

Rule IDs are permanent public identifiers. A rule may gain clearer wording, but
its meaning will not be silently reassigned.

| ID       | Name                       | Default | Purpose                                             |
| -------- | -------------------------- | ------- | --------------------------------------------------- |
| `CCE001` | `frontmatter-schema`       | Error   | Frontmatter failed its JSON Schema                  |
| `CCE002` | `link-target-missing`      | Error   | A relative target does not exist                    |
| `CCE003` | `link-anchor-missing`      | Error   | A heading fragment does not exist                   |
| `CCE004` | `fact-unknown`             | Error   | A canonical fact reference is unknown               |
| `CCE005` | `content-expired`          | Error   | Content reached its expiry date                     |
| `CCE006` | `content-review-overdue`   | Error   | Content review is overdue                           |
| `CCE007` | `content-review-due`       | Warning | Content review is approaching                       |
| `CCE008` | `fact-expired`             | Error   | A canonical fact reached expiry                     |
| `CCE009` | `fact-review-overdue`      | Error   | A fact review is overdue                            |
| `CCE010` | `fact-review-due`          | Warning | A fact review is approaching                        |
| `CCE011` | `date-invalid`             | Error   | A freshness date is not valid                       |
| `CCE012` | `link-anchor-unverifiable` | Error   | A linked Markdown or MDX target could not be parsed |

Use the CLI for the authoritative description:

```powershell
content-contract explain CCE004
content-contract explain fact-unknown --format json
```

Custom validators should use a namespace that cannot collide with `CCE`,
typically an organization prefix such as `ORG001`.
