import type { ContentProject, Finding } from '../types.js';
import { rules } from '../rules.js';

export function validateFactReferences(project: ContentProject): Finding[] {
  const findings: Finding[] = [];

  for (const document of project.documents) {
    for (const reference of document.factReferences) {
      if (Object.hasOwn(project.facts.facts, reference.key)) {
        continue;
      }

      const rule = rules.factUnknown;
      findings.push({
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.defaultSeverity,
        file: document.relativePath,
        location: reference.location,
        message: `Unknown canonical fact "${reference.key}".`,
        help: rule.help,
      });
    }
  }

  return findings;
}
