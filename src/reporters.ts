import type {
  Finding,
  InitResult,
  RenderResult,
  VerificationResult,
} from './types.js';
import type { RuleDefinition } from './rules.js';

export function formatVerification(result: VerificationResult): string {
  const lines: string[] = [];

  for (const finding of result.findings) {
    lines.push(formatFinding(finding));
    lines.push(`  ${finding.help}`);
  }

  if (result.findings.length > 0) {
    lines.push('');
  }

  lines.push(
    `${result.passed ? 'PASS' : 'FAIL'}: ${result.counts.files} file(s), ${result.counts.facts} fact(s), ${result.counts.errors} error(s), ${result.counts.warnings} warning(s), ${result.counts.infos} info message(s).`,
  );
  return lines.join('\n');
}

export function formatFinding(finding: Finding): string {
  const location = finding.location
    ? `:${finding.location.line}:${finding.location.column}`
    : '';
  return `${finding.severity.toUpperCase()} ${finding.ruleId} ${finding.file}${location} ${finding.message}`;
}

export function formatRule(rule: RuleDefinition): string {
  return [
    `${rule.id} ${rule.name}`,
    `Default severity: ${rule.defaultSeverity}`,
    '',
    rule.description,
    '',
    rule.help,
  ].join('\n');
}

export function formatRender(result: RenderResult): string {
  return [
    `Rendered ${result.files.length} file(s) to ${result.outputDirectory}.`,
    ...result.files.map((file) => `  ${file}`),
    ...(result.removedFiles.length > 0
      ? [
          `Removed ${result.removedFiles.length} stale file(s).`,
          ...result.removedFiles.map((file) => `  ${file}`),
        ]
      : []),
  ].join('\n');
}

export function formatInit(result: InitResult): string {
  return [
    `Initialized a content contract project in ${result.directory}.`,
    ...result.files.map((file) => `  ${file}`),
  ].join('\n');
}

export function formatJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
