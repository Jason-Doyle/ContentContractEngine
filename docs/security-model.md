# Security Model

Content Contract Engine is a local build-time validator, not a sandbox or HTML
sanitizer.

## Trusted components

- The Node.js process and installed dependencies
- Project configuration and JSON Schemas selected by the operator
- Custom validators supplied through the library API

Custom validators execute ordinary trusted JavaScript and are outside the
built-in verifier's no-network and no-mutation guarantees.

## Potentially untrusted inputs

- Markdown and MDX source text
- YAML frontmatter
- Fact catalogs
- Linked local documents
- Existing render manifests

These inputs are parsed as data and are never executed.

## Built-in protections

- Referenced schemas, facts, source documents, local links, and render paths are
  constrained to the project directory established by the selected configuration
  file.
- Real paths are checked so symlinks cannot be used to read outside the project.
- Render writes reject symlink traversal and use exclusive temporary files.
- Source documents are never overwritten by rendering.
- Generated output is excluded from subsequent source discovery.
- Existing output is removed only when it appears in the engine-owned render
  manifest.
- External links are not fetched.
- Built-in diagnostics do not include canonical fact values.

## Important limitations

- Fact values are inserted verbatim. Downstream renderers remain responsible for
  context-appropriate escaping and sanitization.
- The engine does not convert Markdown to HTML and does not make content safe to
  display in a browser.
- Rendering is atomic per file, not for the entire output tree.
- A process that can modify the filesystem concurrently may race path checks;
  defending against a hostile local administrator is out of scope.
- There is no configured source-size limit. Very large local inputs can consume
  memory and processing time.
- External URL validity, remote source authenticity, and fact correctness are
  not verified.
- Custom validators can perform arbitrary I/O because they are trusted code.

Security reports should describe the attacker capability, affected path, and a
minimal reproduction without including private content.
