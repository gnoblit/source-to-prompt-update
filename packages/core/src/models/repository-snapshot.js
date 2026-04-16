export function createRepositorySnapshot(input = {}) {
  return {
    repositoryId: input.repositoryId || null,
    rootName: input.rootName || '',
    scannedAt: input.scannedAt || null,
    capabilities: input.capabilities || {},
    limitations: input.limitations || [],
    index: input.index || null,
    diagnosticsSummary: input.diagnosticsSummary || null,
    stats: input.stats || null
  };
}
