export function createProfile(input = {}) {
  return {
    id: input.id || null,
    name: input.name || '',
    selectedPaths: Array.isArray(input.selectedPaths) ? [...input.selectedPaths] : [],
    promptOptions: input.promptOptions || {},
    transformOptions: input.transformOptions || {},
    outputOptions: input.outputOptions || {},
    restoreHints: input.restoreHints || {},
    createdAt: input.createdAt || null,
    updatedAt: input.updatedAt || null
  };
}
