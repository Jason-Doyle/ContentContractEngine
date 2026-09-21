import type {
  BaselineResult,
  ContentProject,
  FailureThreshold,
  Finding,
  Severity,
  VerificationOptions,
  VerificationResult,
} from './types.js';
import { applyBaseline, loadBaseline, writeBaseline } from './baseline.js';
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

export async function createBaseline(
  configPath?: string,
  options: VerificationOptions = {},
): Promise<BaselineResult> {
  const project = await loadProject(configPath);
  const findings = await collectFindings(project, options);
  return writeBaseline(project, findings);
}

export async function verifyProject(
  project: ContentProject,
  options: VerificationOptions = {},
  useBaseline = true,
): Promise<VerificationResult> {
  const failOn = options.failOn ?? project.config.gate.failOn;
  const rawFindings = await collectFindings(project, options);
  const baseline = useBaseline ? await loadBaseline(project.config) : [];
  const { findings, suppressed } = applyBaseline(rawFindings, baseline);
  const counts = {
    files: project.documents.length,
    facts: Object.keys(project.facts.facts).length,
    errors: findings.filter((finding) => finding.severity === 'error').length,
    warnings: findings.filter((finding) => finding.severity === 'warning')
      .length,
    infos: findings.filter((finding) => finding.severity === 'info').length,
    baselined: suppressed,
  };

  return {
    schemaVersion: 1,
    passed: !meetsFailureThreshold(findings, failOn),
    failOn,
    counts,
    findings,
  };
}

async function collectFindings(
  project: ContentProject,
  options: VerificationOptions,
): Promise<Finding[]> {
  const now = options.now ?? new Date();
  const customFindings = await Promise.all(
    (options.validators ?? []).map((validator) =>
      Promise.resolve(validator.validate({ project, now })),
    ),
  );
  return sortFindings([
    ...validateFrontmatter(project),
    ...(await validateLinks(project)),
    ...validateFactReferences(project),
    ...validateFreshness(project, now),
    ...customFindings.flat(),
  ]);
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
