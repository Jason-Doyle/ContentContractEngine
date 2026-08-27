import type { ValidateFunction } from 'ajv';

export type Severity = 'error' | 'warning' | 'info';
export type FailureThreshold = 'error' | 'warning' | 'never';

export interface SourceLocation {
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

export interface Finding {
  ruleId: string;
  ruleName: string;
  severity: Severity;
  file: string;
  location?: SourceLocation;
  message: string;
  help: string;
}

export interface SourceConfig {
  id: string;
  include: string[];
  exclude?: string[];
  frontmatterSchema?: string;
  allowEmpty?: boolean;
}

export interface ProjectConfig {
  $schema?: string;
  version: 1;
  sources: SourceConfig[];
  facts?: {
    file: string;
  };
  freshness?: {
    warningDays?: number;
    reviewByField?: string;
    expiresField?: string;
  };
  render?: {
    outputDirectory: string;
  };
  gate?: {
    failOn?: FailureThreshold;
  };
}

export interface ResolvedSource {
  id: string;
  include: string[];
  exclude: string[];
  frontmatterSchemaPath: string | null;
  validateFrontmatter: ValidateFunction<unknown> | null;
  allowEmpty: boolean;
}

export interface ResolvedProjectConfig {
  rootDirectory: string;
  configPath: string;
  sources: ResolvedSource[];
  factsFilePath: string | null;
  freshness: {
    warningDays: number;
    reviewByField: string;
    expiresField: string;
  };
  render: {
    outputDirectory: string;
  };
  gate: {
    failOn: FailureThreshold;
  };
}

export type FactValue = string | number | boolean;

export interface FactDefinition {
  value: FactValue;
  render?: string;
  owner?: string;
  source?: string;
  reviewBy?: string;
  expires?: string;
}

export interface FactsFile {
  $schema?: string;
  version: 1;
  facts: Record<string, FactDefinition>;
}

export interface FactsCatalog {
  configured: boolean;
  filePath: string | null;
  relativePath: string | null;
  facts: Readonly<Record<string, FactDefinition>>;
}

export interface HeadingReference {
  text: string;
  slug: string;
  location: SourceLocation;
}

export interface LinkReference {
  kind: 'link' | 'image';
  url: string;
  location: SourceLocation;
}

export interface FactReference {
  key: string;
  raw: string;
  startOffset: number;
  endOffset: number;
  location: SourceLocation;
}

export interface ContentDocument {
  sourceId: string;
  absolutePath: string;
  relativePath: string;
  sourceText: string;
  body: string;
  bodyOffset: number;
  bodyStartLine: number;
  frontmatter: Readonly<Record<string, unknown>>;
  headings: readonly HeadingReference[];
  anchors: ReadonlySet<string>;
  links: readonly LinkReference[];
  factReferences: readonly FactReference[];
}

export interface ContentProject {
  config: ResolvedProjectConfig;
  documents: readonly ContentDocument[];
  documentsByPath: ReadonlyMap<string, ContentDocument>;
  facts: FactsCatalog;
}

export interface VerificationCounts {
  files: number;
  facts: number;
  errors: number;
  warnings: number;
  infos: number;
}

export interface VerificationResult {
  schemaVersion: 1;
  passed: boolean;
  failOn: FailureThreshold;
  counts: VerificationCounts;
  findings: readonly Finding[];
}

export interface VerificationOptions {
  now?: Date;
  failOn?: FailureThreshold;
  validators?: readonly ContentValidator[];
}

export interface ValidatorContext {
  project: ContentProject;
  now: Date;
}

export interface ContentValidator {
  name: string;
  validate:
    | ((context: ValidatorContext) => readonly Finding[])
    | ((context: ValidatorContext) => Promise<readonly Finding[]>);
}

export interface RenderResult {
  outputDirectory: string;
  files: readonly string[];
  removedFiles: readonly string[];
}

export interface RenderExecution {
  schemaVersion: 1;
  verification: VerificationResult;
  render: RenderResult | null;
}

export interface InitResult {
  directory: string;
  files: readonly string[];
}
