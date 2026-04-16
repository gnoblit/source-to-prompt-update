import {
  applyPathFilter,
  computeRenderedRows
} from '../../../core/src/selection/filter-engine.js';
import { computeFolderSelectionStats } from '../../../core/src/selection/selection-engine.js';
import { listRootPaths } from '../../../core/src/models/repository-index.js';

function getIndex(state) {
  return state?.repository?.snapshot?.index || null;
}

function sortChildEntries(index, childPaths = []) {
  return [...childPaths].sort((left, right) => {
    const leftEntry = index.entriesByPath.get(left);
    const rightEntry = index.entriesByPath.get(right);
    if (leftEntry.kind === rightEntry.kind) {
      return leftEntry.name.localeCompare(rightEntry.name);
    }
    return leftEntry.kind === 'directory' ? -1 : 1;
  });
}

function walkTree(index, path, rows) {
  const entry = index.entriesByPath.get(path);
  if (!entry) {
    return;
  }

  rows.push({
    path: entry.path,
    name: entry.name,
    kind: entry.kind,
    depth: entry.depth,
    isText: entry.isText,
    size: entry.size,
    lines: entry.lines
  });

  if (entry.kind !== 'directory') {
    return;
  }

  const childPaths = sortChildEntries(
    index,
    index.directChildPathsByDirectory.get(path) || []
  );
  for (const childPath of childPaths) {
    walkTree(index, childPath, rows);
  }
}

export function selectTreeRows(state) {
  const index = getIndex(state);
  if (!index) {
    return [];
  }

  const rows = [];
  for (const rootPath of listRootPaths(index)) {
    walkTree(index, rootPath, rows);
  }
  return rows;
}

export function selectCollapsedFolders(state) {
  const index = getIndex(state);
  if (!index) {
    return new Set();
  }

  const expandedFolders = state?.ui?.expandedFolders || new Set();
  const collapsed = new Set();
  for (const entry of index.entriesByPath.values()) {
    if (entry.kind === 'directory' && !expandedFolders.has(entry.path)) {
      collapsed.add(entry.path);
    }
  }
  return collapsed;
}

export function selectTreeView(state) {
  const index = getIndex(state);
  if (!index) {
    return {
      rows: [],
      visibleRows: [],
      filterVisiblePaths: new Set(),
      rowVisibilityByPath: new Map(),
      filterQueryActive: false
    };
  }

  const rows = selectTreeRows(state);
  const allPaths = rows.map((row) => row.path);
  const filterResult = applyPathFilter({
    allPaths,
    query: state?.filter?.query || '',
    pathExists: (path) => index.entriesByPath.has(path)
  });
  const renderResult = computeRenderedRows({
    rows,
    filterVisiblePaths: filterResult.filterVisiblePaths,
    ancestorsByPath: index.ancestorsByPath,
    collapsedFolders: selectCollapsedFolders(state),
    filterQueryActive: filterResult.filterQueryActive
  });

  return {
    rows,
    visibleRows: renderResult.visibleRows,
    filterVisiblePaths: filterResult.filterVisiblePaths,
    rowVisibilityByPath: renderResult.rowVisibilityByPath,
    filterQueryActive: filterResult.filterQueryActive
  };
}

export function selectSelectionTally(state) {
  const index = getIndex(state);
  if (!index) {
    return {
      selectedTotalSize: 0,
      selectedKnownLines: 0,
      selectedUnknownLineFiles: 0
    };
  }

  let selectedTotalSize = 0;
  let selectedKnownLines = 0;
  let selectedUnknownLineFiles = 0;

  for (const path of state?.selection?.selectedPaths || []) {
    const entry = index.textFilesByPath.get(path);
    if (!entry) {
      continue;
    }

    selectedTotalSize += entry.size || 0;
    if (typeof entry.lines === 'number') {
      selectedKnownLines += entry.lines;
    } else {
      selectedUnknownLineFiles += 1;
    }
  }

  return {
    selectedTotalSize,
    selectedKnownLines,
    selectedUnknownLineFiles
  };
}

export function selectFolderSelectionStats(state) {
  const index = getIndex(state);
  if (!index) {
    return {
      visibleFilePaths: new Set(),
      filterVisibleFilePaths: new Set(),
      folderVisibleFileCount: new Map(),
      folderSelectedVisibleFileCount: new Map()
    };
  }

  const treeView = selectTreeView(state);
  const folderPaths = [];
  for (const entry of index.entriesByPath.values()) {
    if (entry.kind === 'directory') {
      folderPaths.push(entry.path);
    }
  }

  return computeFolderSelectionStats({
    folderPaths,
    filePaths: Array.from(index.textFilesByPath.keys()),
    filterVisiblePaths: treeView.filterVisiblePaths,
    rowVisibilityByPath: treeView.rowVisibilityByPath,
    selectedPaths: state?.selection?.selectedPaths || new Set(),
    ancestorsByFilePath: index.ancestorsByPath
  });
}

export function selectFolderCheckboxState(state, folderPath) {
  const stats = selectFolderSelectionStats(state);
  const visibleCount = stats.folderVisibleFileCount.get(folderPath) || 0;
  const selectedVisibleCount = stats.folderSelectedVisibleFileCount.get(folderPath) || 0;

  return {
    visibleCount,
    selectedVisibleCount,
    checked: visibleCount > 0 && selectedVisibleCount === visibleCount,
    indeterminate: selectedVisibleCount > 0 && selectedVisibleCount < visibleCount
  };
}

export function getCombineEligibility(state) {
  return Boolean(state?.selection?.selectedPaths && state.selection.selectedPaths.size > 0);
}
