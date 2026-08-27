import { describe, expect, it } from 'vitest';

import { findRule, type VerificationResult } from '../src/index.js';
import {
  formatFinding,
  formatInit,
  formatJson,
  formatRender,
  formatRule,
  formatVerification,
} from '../src/reporters.js';

const failedResult: VerificationResult = {
  schemaVersion: 1,
  passed: false,
  failOn: 'error',
  counts: {
    files: 1,
    facts: 0,
    errors: 1,
    warnings: 0,
    infos: 0,
  },
  findings: [
    {
      ruleId: 'CCE002',
      ruleName: 'link-target-missing',
      severity: 'error',
      file: 'content/index.md',
      location: { line: 4, column: 2 },
      message: 'Missing.',
      help: 'Fix the link.',
    },
  ],
};

describe('reporters', () => {
  it('formats findings and verification summaries', () => {
    expect(formatFinding(failedResult.findings[0]!)).toBe(
      'ERROR CCE002 content/index.md:4:2 Missing.',
    );
    expect(formatVerification(failedResult)).toContain(
      'FAIL: 1 file(s), 0 fact(s), 1 error(s)',
    );
  });

  it('formats rule, render, initialization, and JSON output', () => {
    const rule = findRule('CCE002');
    expect(rule).toBeDefined();
    expect(formatRule(rule!)).toContain('link-target-missing');
    expect(
      formatRender({
        outputDirectory: 'rendered',
        files: ['content/index.md'],
        removedFiles: ['content/old.md'],
      }),
    ).toContain('Removed 1 stale file(s)');
    expect(
      formatInit({
        directory: 'project',
        files: ['content/index.md'],
      }),
    ).toContain('Initialized');
    expect(formatJson({ ok: true })).toBe('{\n  "ok": true\n}\n');
  });
});
