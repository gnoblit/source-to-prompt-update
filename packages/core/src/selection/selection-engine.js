import { createSelectionSet } from '../models/selection-set.js';

function getRecordLineCount(record) {
  return record && typeof record.lines === 'number' ? record.lines : null;
}

export function createSelectionState(input = {}) {
  const selectionSet = createSelectionSet(input);

  return {
    selectedPaths: selectionSet.selectedPaths,
    filterSelectedPaths: selectionSet.filterSelectedPaths,
    selectedTotalSize: typeof input.selectedTotalSize === 'number' ? input.selectedTotalSize : 0,
    selectedKnownLines: typeof input.selectedKnownLines === 'number' ? input.selectedKnownLines : 0,
    selectedUnknownLineFiles: Number.isInteger(input.selectedUnknownLineFiles)
      ? input.selectedUnknownLineFiles
      : 0
  };
}

export function computeFolderSelectionStats({
  folderPaths = [],
  filePaths = [],
  filterVisiblePaths = new Set(),
  rowVisibilityByPath = new Map(),
  selectedPaths = new Set(),
  ancestorsByFilePath = new Map()
} = {}) {
  const visibleFilePaths = new Set();
  const filterVisibleFilePaths = new Set();
  const folderVisibleFileCount = new Map();
  const folderSelectedVisibleFileCount = new Map();

  for (const folderPath of folderPaths) {
    folderVisibleFileCount.set(folderPath, 0);
    folderSelectedVisibleFileCount.set(folderPath, 0);
  }

  for (const filePath of filePaths) {
    const isFilterVisible = filterVisiblePaths.has(filePath);
    if (isFilterVisible) {
      filterVisibleFilePaths.add(filePath);
    }
    if (rowVisibilityByPath.get(filePath) === true) {
      visibleFilePaths.add(filePath);
    }
    if (!isFilterVisible) {
      continue;
    }

    const isSelected = selectedPaths.has(filePath);
    const ancestors = ancestorsByFilePath.get(filePath) || [];
    for (const folderPath of ancestors) {
      folderVisibleFileCount.set(folderPath, (folderVisibleFileCount.get(folderPath) || 0) + 1);
      if (isSelected) {
        folderSelectedVisibleFileCount.set(
          folderPath,
          (folderSelectedVisibleFileCount.get(folderPath) || 0) + 1
        );
      }
    }
  }

  return {
    visibleFilePaths,
    filterVisibleFilePaths,
    folderVisibleFileCount,
    folderSelectedVisibleFileCount
  };
}

export function applySelectionChange({
  state,
  paths = [],
  shouldSelect,
  fileRecordsByPath = new Map(),
  ancestorsByFilePath = new Map(),
  filterVisibleFilePaths = new Set(),
  options = {}
} = {}) {
  const nextState = createSelectionState(state);
  const folderDeltaByPath = new Map();
  let changed = false;

  const trackFilterSelections = options.trackFilterSelections === true;
  const clearFilterSelections = options.clearFilterSelections === true;

  for (const path of paths) {
    const record = fileRecordsByPath.get(path);
    if (!record) {
      continue;
    }

    const wasSelected = nextState.selectedPaths.has(path);
    if (wasSelected === shouldSelect) {
      if (clearFilterSelections && !shouldSelect) {
        nextState.filterSelectedPaths.delete(path);
      }
      continue;
    }

    changed = true;

    if (shouldSelect) {
      nextState.selectedPaths.add(path);
      nextState.selectedTotalSize += record.size || 0;
      const lines = getRecordLineCount(record);
      if (lines === null) {
        nextState.selectedUnknownLineFiles += 1;
      } else {
        nextState.selectedKnownLines += lines;
      }
      if (trackFilterSelections) {
        nextState.filterSelectedPaths.add(path);
      }
    } else {
      nextState.selectedPaths.delete(path);
      nextState.selectedTotalSize = Math.max(0, nextState.selectedTotalSize - (record.size || 0));
      const lines = getRecordLineCount(record);
      if (lines === null) {
        nextState.selectedUnknownLineFiles = Math.max(0, nextState.selectedUnknownLineFiles - 1);
      } else {
        nextState.selectedKnownLines = Math.max(0, nextState.selectedKnownLines - lines);
      }
      if (clearFilterSelections) {
        nextState.filterSelectedPaths.delete(path);
      }
    }

    if (filterVisibleFilePaths.has(path)) {
      const delta = shouldSelect ? 1 : -1;
      const ancestors = ancestorsByFilePath.get(path) || [];
      for (const folderPath of ancestors) {
        folderDeltaByPath.set(folderPath, (folderDeltaByPath.get(folderPath) || 0) + delta);
      }
    }
  }

  return {
    changed,
    nextState,
    folderDeltaByPath
  };
}

export function reconcileSelectedPaths({ selectedPaths = new Set(), availablePaths = new Set() } = {}) {
  const reconciledPaths = new Set();

  for (const path of selectedPaths) {
    if (availablePaths.has(path)) {
      reconciledPaths.add(path);
    }
  }

  return reconciledPaths;
}
