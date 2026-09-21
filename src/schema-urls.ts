import { version } from './version.js';

export type BundledSchemaName =
  | 'baseline.schema.json'
  | 'content-contract.config.schema.json'
  | 'facts.schema.json'
  | 'render-execution.schema.json'
  | 'verification-result.schema.json';

export function publishedSchemaUrl(name: BundledSchemaName): string {
  return `https://raw.githubusercontent.com/Jason-Doyle/ContentContractEngine/v${version}/schemas/${name}`;
}
