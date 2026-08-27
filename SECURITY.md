# Security Policy

## Reporting

Do not publish suspected vulnerabilities before maintainers have had a
reasonable opportunity to investigate. Report them through a
[private GitHub security advisory](https://github.com/Jason-Doyle/ContentContractEngine/security/advisories/new).

## Security boundaries

- The core verifier does not execute document code.
- The verifier does not transmit content or telemetry.
- External network validation is out of scope for the initial release.
- Rendering writes only beneath an explicitly validated output directory.
- Built-in diagnostics report paths, fact identifiers, and dates but never fact
  values.

Security claims should be supported by tests and precise threat-model
documentation. See [docs/security-model.md](docs/security-model.md).
