import type { ContentProject, Finding } from '../types.js';
import { formatSchemaErrors } from '../schema.js';
import { rules } from '../rules.js';

export function validateFrontmatter(project: ContentProject): Finding[] {
  const sourceValidators = new Map(
    project.config.sources.map((source) => [
      source.id,
      source.validateFrontmatter,
    ]),
  );
  const findings: Finding[] = [];

  for (const document of project.documents) {
    const validator = sourceValidators.get(document.sourceId);
    if (!validator || validator(document.frontmatter)) {
      continue;
    }

    const rule = rules.frontmatterSchema;
    findings.push({
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.defaultSeverity,
      file: document.relativePath,
      location: { line: 1, column: 1 },
      message: formatSchemaErrors(validator.errors),
      help: rule.help,
    });
  }

  return findings;
}
