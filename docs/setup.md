# Setup

## Requirements

- Windows, macOS, or Linux
- Node.js 22 or newer
- npm 10 or newer

Repository CI is configured to run the full quality suite on Node.js 22 and 24
across Windows and Ubuntu.

## Install dependencies

```powershell
npm ci
```

The package remains marked `private` until its first npm publication. This does
not limit local builds, tests, package inspection, or installation from a local
directory.

## Quality checks

```powershell
npm run qa
```

The quality command checks formatting, lint rules, TypeScript types, coverage,
the production build, the included example, the npm executable, package
contents, and installation into a clean temporary project.

## Development commands

| Command                  | Purpose                                              |
| ------------------------ | ---------------------------------------------------- |
| `npm run test`           | Run the test suite once                              |
| `npm run test:coverage`  | Run tests with enforced coverage thresholds          |
| `npm run typecheck`      | Check TypeScript without emitting files              |
| `npm run lint`           | Run ESLint                                           |
| `npm run format`         | Apply Prettier formatting                            |
| `npm run build`          | Compile the library and CLI                          |
| `npm run verify:self`    | Validate the repository documentation                |
| `npm run verify:example` | Verify the included example                          |
| `npm run render:example` | Render the included example                          |
| `npm run qa`             | Run the complete release-quality validation sequence |

No hosted service, database, or account is required.

## Try the CLI

```powershell
npm run build
node dist/bin.js init .\scratch
node dist/bin.js verify --config .\scratch\content-contract.config.json
node dist/bin.js render --config .\scratch\content-contract.config.json
```

The initialized project includes a schema, fact catalog, two linked documents,
and a separate render directory.

## Supported platforms

The implementation uses Node.js file-system and path APIs. The full suite has
been run on Windows and Debian Linux with Node.js 22 and 24. Repository CI is
configured for Windows and Ubuntu. macOS is intended to be supported but is not
currently part of the automated matrix.

Link validation checks path casing explicitly so a link that works accidentally
on Windows does not fail after deployment to Linux.
