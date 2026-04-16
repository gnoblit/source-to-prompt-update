export function createTransformPlan(input = {}) {
  return {
    transforms: Array.isArray(input.transforms) ? [...input.transforms] : [],
    safetyClass: input.safetyClass || 'safe',
    executionStrategy: input.executionStrategy || 'inline',
    warnings: Array.isArray(input.warnings) ? [...input.warnings] : []
  };
}
