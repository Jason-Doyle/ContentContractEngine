import type {
  ContentProject,
  FailureThreshold,
  Finding,
  Severity,
  VerificationOptions,
  VerificationResult,
} from './types.js';
import { loadProject } from './project.js';
import { validateFactReferences } from './validators/facts.js';
import { validateFreshness } from './validators/freshness.js';
import { validateFrontmatter } from './validators/frontmatter.js';
import { validateLinks } from './validators/links.js';

const severityOrder: Record<Severity, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

export async function verify(
  configPath?: string,
  options: VerificationOptions = {},
): Promise<VerificationResult> {
  const project = await loadProject(configPath);
  return verifyProject(project, options);
}

export async function verifyProject(
  project: ContentProject,
  options: VerificationOptions = {},
): Promise<VerificationResult> {
  const now = options.now ?? new Date();
  const failOn = options.failOn ?? project.config.gate.failOn;
  const customFindings = await Promise.all(
    (options.validators ?? []).map((validator) =>
      Promise.resolve(validator.validate({ project, now })),
    ),
  );
  const findings = sortFindings([
    ...validateFrontmatter(project),
    ...(await validateLinks(project)),
    ...validateFactReferences(project),
    ...validateFreshness(project, now),
    ...customFindings.flat(),
  ]);
  const counts = {
    files: project.documents.length,
    facts: Object.keys(project.facts.facts).length,
    errors: findings.filter((finding) => finding.severity === 'error').length,
    warnings: findings.filter((finding) => finding.severity === 'warning')
      .length,
    infos: findings.filter((finding) => finding.severity === 'info').length,
  };

  return {
    schemaVersion: 1,
    passed: !meetsFailureThreshold(findings, failOn),
    failOn,
    counts,
    findings,
  };
}

export function meetsFailureThreshold(
  findings: readonly Finding[],
  threshold: FailureThreshold,
): boolean {
  if (threshold === 'never') {
    return false;
  }
  return findings.some((finding) =>
    threshold === 'error'
      ? finding.severity === 'error'
      : finding.severity === 'error' || finding.severity === 'warning',
  );
}

export function sortFindings(findings: readonly Finding[]): Finding[] {
  return [...findings].sort((left, right) => {
    return (
      left.file.localeCompare(right.file, 'en') ||
      (left.location?.line ?? 0) - (right.location?.line ?? 0) ||
      (left.location?.column ?? 0) - (right.location?.column ?? 0) ||
      severityOrder[left.severity] - severityOrder[right.severity] ||
      left.ruleId.localeCompare(right.ruleId, 'en') ||
      left.message.localeCompare(right.message, 'en')
    );
  });
}
