export function createSelectionSet(input = {}) {
  return {
    selectedPaths: input.selectedPaths ? new Set(input.selectedPaths) : new Set(),
    filterSelectedPaths: input.filterSelectedPaths ? new Set(input.filterSelectedPaths) : new Set()
  };
}
