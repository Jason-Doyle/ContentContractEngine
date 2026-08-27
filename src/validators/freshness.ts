import type {
  ContentProject,
  FactDefinition,
  Finding,
  SourceLocation,
} from '../types.js';
import { rules, type RuleDefinition } from '../rules.js';

const millisecondsPerDay = 86_400_000;

export function validateFreshness(
  project: ContentProject,
  now: Date,
): Finding[] {
  const findings: Finding[] = [];
  const currentDay = utcDay(now);

  for (const document of project.documents) {
    const reviewBy =
      document.frontmatter[project.config.freshness.reviewByField];
    const expires = document.frontmatter[project.config.freshness.expiresField];

    checkDates({
      reviewBy,
      expires,
      file: document.relativePath,
      location: { line: 1, column: 1 },
      currentDay,
      warningDays: project.config.freshness.warningDays,
      expiredRule: rules.contentExpired,
      overdueRule: rules.contentReviewOverdue,
      dueRule: rules.contentReviewDue,
      findings,
    });
  }

  if (project.facts.relativePath) {
    for (const [key, fact] of Object.entries(project.facts.facts)) {
      checkFact(
        key,
        fact,
        project.facts.relativePath,
        currentDay,
        project.config.freshness.warningDays,
        findings,
      );
    }
  }

  return findings;
}

function checkFact(
  key: string,
  fact: FactDefinition,
  file: string,
  currentDay: number,
  warningDays: number,
  findings: Finding[],
): void {
  checkDates({
    reviewBy: fact.reviewBy,
    expires: fact.expires,
    file,
    currentDay,
    warningDays,
    expiredRule: rules.factExpired,
    overdueRule: rules.factReviewOverdue,
    dueRule: rules.factReviewDue,
    subject: `Fact "${key}"`,
    findings,
  });
}

interface DateCheckInput {
  reviewBy: unknown;
  expires: unknown;
  file: string;
  location?: SourceLocation;
  currentDay: number;
  warningDays: number;
  expiredRule: RuleDefinition;
  overdueRule: RuleDefinition;
  dueRule: RuleDefinition;
  subject?: string;
  findings: Finding[];
}

function checkDates(input: DateCheckInput): void {
  const subject = input.subject ?? 'Content';

  if (input.expires !== undefined) {
    const expiresText =
      typeof input.expires === 'string' ? input.expires : null;
    const expiryLabel = expiresText ?? 'invalid date';
    const expiry = parseDate(expiresText);
    if (expiry === null) {
      input.findings.push(
        dateFinding(
          rules.dateInvalid,
          input.file,
          `${subject} has an invalid expiry date.`,
          input.location,
        ),
      );
    } else if (input.currentDay >= expiry) {
      input.findings.push(
        dateFinding(
          input.expiredRule,
          input.file,
          `${subject} expired on ${expiryLabel}.`,
          input.location,
        ),
      );
    }
  }

  if (input.reviewBy === undefined) {
    return;
  }

  const reviewText = typeof input.reviewBy === 'string' ? input.reviewBy : null;
  const reviewLabel = reviewText ?? 'invalid date';
  const reviewDay = parseDate(reviewText);
  if (reviewDay === null) {
    input.findings.push(
      dateFinding(
        rules.dateInvalid,
        input.file,
        `${subject} has an invalid review date.`,
        input.location,
      ),
    );
    return;
  }

  const daysUntil = Math.round(
    (reviewDay - input.currentDay) / millisecondsPerDay,
  );
  if (daysUntil < 0) {
    input.findings.push(
      dateFinding(
        input.overdueRule,
        input.file,
        `${subject} review was due on ${reviewLabel}.`,
        input.location,
      ),
    );
    return;
  }

  if (daysUntil <= input.warningDays) {
    input.findings.push(
      dateFinding(
        input.dueRule,
        input.file,
        `${subject} review is due on ${reviewLabel} (${daysUntil} day${daysUntil === 1 ? '' : 's'} remaining).`,
        input.location,
      ),
    );
  }
}

function dateFinding(
  rule: RuleDefinition,
  file: string,
  message: string,
  location?: SourceLocation,
): Finding {
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    severity: rule.defaultSeverity,
    file,
    ...(location ? { location } : {}),
    message,
    help: rule.help,
  };
}

function parseDate(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return timestamp;
}

function utcDay(value: Date): number {
  return Date.UTC(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate(),
  );
}
