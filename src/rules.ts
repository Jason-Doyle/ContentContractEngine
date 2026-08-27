export interface RuleDefinition {
  id: string;
  name: string;
  defaultSeverity: 'error' | 'warning' | 'info';
  description: string;
  help: string;
}

export const rules = {
  frontmatterSchema: {
    id: 'CCE001',
    name: 'frontmatter-schema',
    defaultSeverity: 'error',
    description: 'Document frontmatter must satisfy its source JSON Schema.',
    help: 'Update the frontmatter or the declared schema so they agree.',
  },
  linkTargetMissing: {
    id: 'CCE002',
    name: 'link-target-missing',
    defaultSeverity: 'error',
    description: 'Relative content links must resolve to an existing target.',
    help: 'Correct the relative path or add the missing target.',
  },
  linkAnchorMissing: {
    id: 'CCE003',
    name: 'link-anchor-missing',
    defaultSeverity: 'error',
    description: 'Markdown heading fragments must resolve in the target.',
    help: 'Correct the fragment or restore the referenced heading.',
  },
  factUnknown: {
    id: 'CCE004',
    name: 'fact-unknown',
    defaultSeverity: 'error',
    description: 'Every explicit fact reference must exist in the fact file.',
    help: 'Add the fact to the configured fact file or correct the reference.',
  },
  contentExpired: {
    id: 'CCE005',
    name: 'content-expired',
    defaultSeverity: 'error',
    description: 'Expired content must not pass release validation.',
    help: 'Review, update, or remove the content and set a new expiry date.',
  },
  contentReviewOverdue: {
    id: 'CCE006',
    name: 'content-review-overdue',
    defaultSeverity: 'error',
    description: 'Content has passed its required review date.',
    help: 'Review the content and move the review date forward.',
  },
  contentReviewDue: {
    id: 'CCE007',
    name: 'content-review-due',
    defaultSeverity: 'warning',
    description: 'Content is approaching its required review date.',
    help: 'Schedule a review before the date becomes overdue.',
  },
  factExpired: {
    id: 'CCE008',
    name: 'fact-expired',
    defaultSeverity: 'error',
    description: 'An expired canonical fact must not be rendered.',
    help: 'Verify the fact against its source and set a new expiry date.',
  },
  factReviewOverdue: {
    id: 'CCE009',
    name: 'fact-review-overdue',
    defaultSeverity: 'error',
    description: 'A canonical fact has passed its required review date.',
    help: 'Verify the fact against its source and move the review date forward.',
  },
  factReviewDue: {
    id: 'CCE010',
    name: 'fact-review-due',
    defaultSeverity: 'warning',
    description: 'A canonical fact is approaching its review date.',
    help: 'Schedule verification with the listed owner or source.',
  },
  dateInvalid: {
    id: 'CCE011',
    name: 'date-invalid',
    defaultSeverity: 'error',
    description: 'Freshness dates must use a valid YYYY-MM-DD value.',
    help: 'Replace the value with a real calendar date in YYYY-MM-DD form.',
  },
  linkAnchorUnverifiable: {
    id: 'CCE012',
    name: 'link-anchor-unverifiable',
    defaultSeverity: 'error',
    description:
      'A heading fragment could not be checked because its target is not parseable.',
    help: 'Correct the target document or include it in a compatible content source.',
  },
} as const satisfies Record<string, RuleDefinition>;

export const rulesById = new Map<string, RuleDefinition>(
  Object.values(rules).map((rule) => [rule.id, rule]),
);

export const rulesByName = new Map<string, RuleDefinition>(
  Object.values(rules).map((rule) => [rule.name, rule]),
);

export function findRule(identifier: string): RuleDefinition | undefined {
  return (
    rulesById.get(identifier.toUpperCase()) ??
    rulesByName.get(identifier.toLowerCase())
  );
}
