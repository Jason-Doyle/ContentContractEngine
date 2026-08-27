import type { ContentProject } from './types.js';
import { loadProjectConfig } from './config.js';
import { discoverDocuments } from './discovery.js';
import { loadFacts } from './facts.js';

export async function loadProject(
  configPath?: string,
): Promise<ContentProject> {
  const config = await loadProjectConfig(configPath);
  const [documents, facts] = await Promise.all([
    discoverDocuments(config),
    loadFacts(config),
  ]);
  const documentsByPath = new Map(
    documents.map((document) => [document.relativePath, document]),
  );

  return {
    config,
    documents,
    documentsByPath,
    facts,
  };
}
